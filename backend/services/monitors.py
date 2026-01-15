import asyncio
import re
import json
import time
from datetime import datetime

import paramiko
from pysnmp.hlapi.asyncio import *
from sqlalchemy.orm import Session

from models.device import Device, DeviceMetric, DeviceCredential
from database import SessionLocal
from services.alerting import check_for_alerts
from services.encryptor import decrypt_value
from services.websocket_manager import manager
from services.redis_service import redis_service
from services.auditlogger import log_action

async def ping_device(ip: str):
    """ICMP check supporting both IP and Hostnames"""
    """Shouldn't be vulnerable to OS command injection. Houston, do we have a problem?"""
    try:
        proc = await asyncio.create_subprocess_exec(
            'ping', '-c', '1', '-W', '2', ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            match = re.search(r'time=([\d.]+)', stdout.decode())
            return True, float(match.group(1)) if match else 0.0
        
        return False, None
    except Exception as e:
        print(f"DEBUG: Ping failure for {ip}: {e}")
        return False, None


async def collect_snmp_data(ip: str, community: str):
    """Real SNMP polling using UCD-SNMP-MIB (CPU/Mem) and IF-MIB (Traffic)"""
    try:
        snmp_engine = SnmpEngine()
        iterator = getCmd(
            snmp_engine,
            CommunityData(community),
            UdpTransportTarget((ip, 161), timeout=2.0, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.11.11.0')),  # cpu idle
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.5.0')),    # total mem
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.6.0')),    # avail mem
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.14.0')),   # buffers
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.15.0')),   # cached
            ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.10.2')),    # in octets
            ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.16.2'))     # out octets
        )

        error_indication, error_status, error_index, var_binds = await iterator

        if error_indication:
            raise Exception(str(error_indication))
        if error_status:
            raise Exception(f"{error_status.prettyPrint()} at {error_index and var_binds[int(error_index) - 1][0] or '?'}")

        # 1. CPU Calculation
        idle_cpu = float(var_binds[0][1]) if var_binds else 100.0
        cpu = max(0.0, 100.0 - idle_cpu)
        
        # 2. Memory Calculation
        total_mem, avail_mem = float(var_binds[1][1]), float(var_binds[2][1])
        buffer_mem, cached_mem = float(var_binds[3][1]), float(var_binds[4][1])
        
        actual_free = avail_mem + buffer_mem + cached_mem
        mem_pct = ((total_mem - actual_free) / total_mem * 100) if total_mem > 0 else 0.0
        
        # 3. Traffic Calculation
        current_in = int(var_binds[5][1]) if len(var_binds) > 5 and var_binds[5][1] is not None else 0
        current_out = int(var_binds[6][1]) if len(var_binds) > 6 and var_binds[6][1] is not None else 0
            
        current_total = current_in + current_out
        current_time = time.time()
        traffic_mbs = 0.0
        
        if redis_service.redis_client:
            redis_key = f"device:{ip}:traffic"
            prev_data_json = redis_service.redis_client.get(redis_key)
            
            if prev_data_json:
                try:
                    prev_data = json.loads(prev_data_json)
                    time_diff = current_time - prev_data["time"]
                    octet_diff = current_total - prev_data["octets"]
                    
                    if 0 < time_diff < 300 and octet_diff >= 0:
                        traffic_mbs = (octet_diff / 1048576) / time_diff
                except Exception: pass
            
            redis_service.redis_client.set(redis_key, json.dumps({"octets": current_total, "time": current_time}), ex=600)

        return round(cpu, 2), round(mem_pct, 2), round(traffic_mbs, 4)
    except Exception as e:
        err_msg = str(e).lower()
        if any(x in err_msg for x in ["no response", "timed out", "authorization"]):
            return "AUTH_FAILED", None, None
        return "ERROR", None, None

async def collect_ssh_data(ip: str, username: str, password: str):
    """Real SSH polling for Linux metrics with stateful throughput"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(ip, username=username, password=password, timeout=5)
        
        # CPU & Memory
        _, stdout, _ = client.exec_command("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'; free | grep Mem | awk '{print $3/$2 * 100}'")
        output_lines = stdout.read().decode().splitlines()
        cpu = float(output_lines[0].strip() or 0) if len(output_lines) > 0 else 0.0
        mem = float(output_lines[1].strip() or 0) if len(output_lines) > 1 else 0.0
        
        # Traffic
        cmd = "cat /proc/net/dev | tail -n +3 | awk '{rx+=$2; tx+=$10} END {print rx+tx}'"
        _, stdout, _ = client.exec_command(cmd)
        current_total = int(stdout.read().decode().strip() or 0)
        current_time, traffic_mbs = time.time(), 0.0
        
        if redis_service.redis_client:
            redis_key = f"device:{ip}:ssh_traffic"
            prev_data_json = redis_service.redis_client.get(redis_key)
            if prev_data_json:
                try:
                    prev_data = json.loads(prev_data_json)
                    time_diff = current_time - prev_data["time"]
                    octet_diff = current_total - prev_data["octets"]
                    if 0 < time_diff < 300 and octet_diff >= 0:
                        traffic_mbs = (octet_diff / 1048576) / time_diff
                except Exception: pass
            redis_service.redis_client.set(redis_key, json.dumps({"octets": current_total, "time": current_time}), ex=600)

        client.close()
        return round(cpu, 2), round(mem, 2), round(traffic_mbs, 4)
    except paramiko.AuthenticationException:
        return "AUTH_FAILED", None, None
    except Exception:
        return "ERROR", None, None

async def poll_device(device_id: int):
    """Independent polling task with its own DB session"""
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device: return

        is_online, latency = await ping_device(device.ip_address)
        cpu, memory, traffic, poll_error = None, None, None, None
        
        if is_online:
            ssh_cred = next((c for c in device.credentials if c.type == "ssh" and c.username and c.password), None)
            snmp_cred = next((c for c in device.credentials if c.type == "snmp" and c.community_string), None)
            
            failing_set = set(json.loads(device.failing_protocols or "[]"))
            errors = []

            # 1. SSH Polling
            if ssh_cred:
                try:
                    u, p = decrypt_value(ssh_cred.username), decrypt_value(ssh_cred.password)
                    if u and p:
                        s_cpu, s_mem, s_traf = await collect_ssh_data(device.ip_address, u, p)
                        if s_cpu in ["AUTH_FAILED", "ERROR"]:
                            failing_set.add("ssh")
                            errors.append(f"SSH {s_cpu.replace('_', ' ').title()}")
                            log_action(db=db, action=f"alert_{'critical' if s_cpu == 'AUTH_FAILED' else 'warning'}_ssh_error", 
                                       actor_email="system@monitor", target_type="device", target_name=device.name)
                        else:
                            failing_set.discard("ssh")
                            cpu, memory, traffic = s_cpu, s_mem, s_traf
                except Exception:
                    failing_set.add("ssh")
                    errors.append("SSH Exception")
            else:
                failing_set.discard("ssh")

            # 2. SNMP Polling
            if snmp_cred:
                try:
                    community = decrypt_value(snmp_cred.community_string)
                    if community:
                        n_cpu, n_mem, n_traf = await collect_snmp_data(device.ip_address, community)
                        if n_cpu in ["AUTH_FAILED", "ERROR"]:
                            failing_set.add("snmp")
                            errors.append(f"SNMP {n_cpu.replace('_', ' ').title()}")
                            log_action(db=db, action=f"alert_{'critical' if n_cpu == 'AUTH_FAILED' else 'warning'}_snmp_error", 
                                       actor_email="system@monitor", target_type="device", target_name=device.name)
                        else:
                            failing_set.discard("snmp")
                            if cpu is None: cpu, memory, traffic = n_cpu, n_mem, n_traf
                except Exception:
                    failing_set.add("snmp")
                    errors.append("SNMP Exception")
            else:
                failing_set.discard("snmp")
            
            device.failing_protocols = json.dumps(list(failing_set))
            if errors: poll_error = " & ".join(errors)
                
        device.last_status = "online" if is_online else "offline"
        if not is_online: poll_error = "Ping Timeout"
        
        device.last_error = poll_error
        device.last_latency = latency
        device.last_cpu, device.last_memory, device.last_traffic = cpu, memory, traffic
        device.last_polled = datetime.utcnow()
        
        if is_online:
            db.add(DeviceMetric(device_id=device.id, cpu_usage=cpu, memory_usage=memory, traffic=traffic, latency=latency))
        
        db.commit()
        check_for_alerts(db, device)
        
        # Real-time Broadcast
        payload = {
            "id": device.id, "name": device.name, "ip_address": device.ip_address,
            "last_status": device.last_status, "last_cpu": device.last_cpu,
            "last_memory": device.last_memory, "last_latency": device.last_latency,
            "last_traffic": device.last_traffic, 
            "last_polled": device.last_polled.isoformat() if device.last_polled else None,
            "last_error": device.last_error, "failing_protocols": device.failing_protocols,
            "configured_credentials": [c.type for c in device.credentials if (c.type=="ssh" and c.username and c.password) or (c.type=="snmp" and c.community_string)]
        }
        
        await manager.broadcast({"type": "device_update", "device": payload})
        await redis_service.publish_device_update(payload)
    except Exception as e:
        print(f"Poll error {device_id}: {e}")
        db.rollback()
    finally:
        db.close()

async def run_monitoring_cycle():
    db = SessionLocal()
    try:
        # Get active device IDs and run them in parallel with fresh sessions
        device_ids = [d.id for d in db.query(Device).filter(Device.is_active == True).all()]
        if not device_ids:
            return
            
        tasks = [poll_device(did) for did in device_ids]
        await asyncio.gather(*tasks)
    finally:
        db.close()
