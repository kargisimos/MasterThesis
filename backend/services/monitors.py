import asyncio
import re
import ipaddress
import paramiko
import json
from pysnmp.hlapi.asyncio import *
from datetime import datetime
from sqlalchemy.orm import Session
from models.device import Device, DeviceMetric, DeviceCredential
from database import SessionLocal
from services.alerting import check_for_alerts
from services.encryptor import decrypt_value
from services.websocket_manager import manager
from services.redis_service import redis_service

async def ping_device(ip: str):
    """Secure ICMP check supporting both IP and Hostnames"""
    try:
        # We don't strictly require a valid IP address anymore to support hostnames
        # But we still time it out quickly
        proc = await asyncio.create_subprocess_exec(
            'ping', '-c', '1', '-W', '2', ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            match = re.search(r'time=([\d.]+)', stdout.decode())
            return True, float(match.group(1)) if match else 0.0
        
        error_msg = stderr.decode().strip()
        print(f"DEBUG: Ping failed for {ip}: {error_msg if error_msg else 'Timeout'}")
        return False, None
    except FileNotFoundError:
        print("CRITICAL: 'ping' utility not found. Please ensure iputils-ping is installed in the container.")
        return False, None
    except Exception as e:
        print(f"DEBUG: Unexpected error in ping_device for {ip}: {e}")
        return False, None


async def collect_snmp_data(ip: str, community: str):
    """Real SNMP polling using UCD-SNMP-MIB (CPU/Mem) and IF-MIB (Traffic)"""
    try:
        from services.redis_service import redis_service
        import time
        
        # OIDs:
        # ssCpuIdle: .1.3.6.1.4.1.2021.11.11.0
        # Total RAM: .1.3.6.1.4.1.2021.4.5.0
        # Avail RAM: .1.3.6.1.4.1.2021.4.6.0
        # Buffers: .1.3.6.1.4.1.2021.4.14.0
        # Cached: .1.3.6.1.4.1.2021.4.15.0
        # ifInOctets.2: .1.3.6.1.2.1.2.2.1.10.2 (Assuming eth0/wlan0 is index 2)
        # ifOutOctets.2: .1.3.6.1.2.1.2.2.1.16.2
        
        snmp_engine = SnmpEngine()
        
        iterator = getCmd(
            snmp_engine,
            CommunityData(community),
            UdpTransportTarget((ip, 161), timeout=2.0, retries=1),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.11.11.0')),  # 0: cpu idle
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.5.0')),    # 1: total mem
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.6.0')),    # 2: avail mem
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.14.0')),   # 3: buffers
            ObjectType(ObjectIdentity('1.3.6.1.4.1.2021.4.15.0')),   # 4: cached
            ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.10.2')),    # 5: in octets
            ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1.16.2'))     # 6: out octets
        )

        error_indication, error_status, error_index, var_binds = await iterator

        if error_indication or error_status:
            print(f"DEBUG: SNMP Error for {ip}: {error_indication or error_status}")
            return None, None, None

        # 1. CPU Calculation
        idle_cpu = float(var_binds[0][1]) if var_binds else 100.0
        cpu = max(0.0, 100.0 - idle_cpu)
        
        # 2. Memory Calculation
        total_mem = float(var_binds[1][1])
        avail_mem = float(var_binds[2][1])
        buffer_mem = float(var_binds[3][1])
        cached_mem = float(var_binds[4][1])
        
        actual_free = avail_mem + buffer_mem + cached_mem
        used_mem = total_mem - actual_free
        mem_pct = (used_mem / total_mem * 100) if total_mem > 0 else 0.0
        
        # 3. Traffic Calculation (Stateful via Redis)
        current_in = int(var_binds[5][1] or 0)
        current_out = int(var_binds[6][1] or 0)
        current_total = current_in + current_out
        current_time = time.time()
        
        traffic_mbps = 0.0
        
        # Retrieve previous values from Redis
        if redis_service.redis_client:
            redis_key = f"device:{ip}:traffic"
            prev_data_json = redis_service.redis_client.get(redis_key)
            
            if prev_data_json:
                prev_data = json.loads(prev_data_json)
                prev_total = prev_data.get("octets", 0)
                prev_time = prev_data.get("time", 0)
                
                time_diff = current_time - prev_time
                octet_diff = current_total - prev_total
                
                # Handle counter wrap or reset (if diff is negative or huge)
                if 0 < time_diff < 120 and octet_diff >= 0:
                    # Bytes -> Bits -> Megabits / Seconds
                    traffic_mbps = (octet_diff * 8) / time_diff / 1_000_000
            
            # Store current values for next poll
            redis_service.redis_client.set(redis_key, json.dumps({
                "octets": current_total,
                "time": current_time
            }), ex=300) # Expire after 5 mins

        print(f"DEBUG: SNMP {ip} -> CPU: {cpu:.1f}%, Mem: {mem_pct:.1f}%, Traf: {traffic_mbps:.2f} Mbps")
        return round(cpu, 2), round(mem_pct, 2), round(traffic_mbps, 2)
    except Exception as e:
        print(f"DEBUG: SNMP Exception for {ip}: {str(e)}")
        return None, None, None

async def collect_ssh_data(ip: str, username: str, password: str):
    """Real SSH polling for Linux metrics"""
    try:
        print(f"DEBUG: Attempting SSH poll for {ip}")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(ip, username=username, password=password, timeout=5)
        
        _, stdout, _ = client.exec_command("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'")
        cpu = float(stdout.read().decode().strip() or 0)
        
        _, stdout, _ = client.exec_command("free | grep Mem | awk '{print $3/$2 * 100}'")
        mem = float(stdout.read().decode().strip() or 0)
        
        client.close()
        print(f"DEBUG: SSH Success for {ip} -> CPU: {cpu}, Mem: {mem}")
        return cpu, mem, 0.0
    except Exception as e:
        print(f"DEBUG: SSH Exception for {ip}: {str(e)}")
        return None, None, None

async def poll_device(device_id: int):
    """Independent polling task with its own DB session"""
    print(f"DEBUG: Starting poll task for device_id: {device_id}")
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            print(f"DEBUG: Device {device_id} not found in DB.")
            return

        print(f"DEBUG: Polling {device.name} ({device.ip_address})...")
        is_online, latency = await ping_device(device.ip_address)
        print(f"DEBUG: {device.name} Online: {is_online} (Latency: {latency})")
        
        cpu, memory, traffic = None, None, None
        
        if is_online:
            # Refresh credentials from DB connection
            ssh_cred = next((c for c in device.credentials if c.type == "ssh"), None)
            snmp_cred = next((c for c in device.credentials if c.type == "snmp"), None)
            
            if ssh_cred:
                print(f"DEBUG: Using SSH for {device.name}")
            if snmp_cred:
                print(f"DEBUG: Using SNMP for {device.name}")
                
            try:
                if ssh_cred:
                    u, p = decrypt_value(ssh_cred.username), decrypt_value(ssh_cred.password)
                    cpu, memory, traffic = await collect_ssh_data(device.ip_address, u, p)
                elif snmp_cred:
                    community = decrypt_value(snmp_cred.community_string)
                    cpu, memory, traffic = await collect_snmp_data(device.ip_address, community)
                else:
                    print(f"DEBUG: No credentials found for {device.name}")
            except Exception as e:
                print(f"DEBUG: Polling protocol error for {device.name}: {e}")
                
        device.last_status = "online" if is_online else "offline"
        device.last_latency = latency
        device.last_cpu = cpu
        device.last_memory = memory
        device.last_traffic = traffic
        device.last_polled = datetime.utcnow()
        
        if is_online:
            db.add(DeviceMetric(
                device_id=device.id, 
                cpu_usage=cpu, 
                memory_usage=memory, 
                traffic=traffic, 
                latency=latency
            ))
        
        db.commit()
        check_for_alerts(db, device)
        
        
        device_payload = {
            "id": device.id,
            "name": device.name,
            "ip_address": device.ip_address,
            "last_status": device.last_status,
            "last_cpu": device.last_cpu,
            "last_memory": device.last_memory,
            "last_latency": device.last_latency,
            "last_traffic": device.last_traffic,
            "last_polled": device.last_polled.isoformat() if device.last_polled else None
        }
        
        await manager.broadcast({
            "type": "device_update",
            "device": device_payload
        })
        
        # Publish to Redis for pub/sub distribution
        await redis_service.publish_device_update(device_payload)
    except Exception as e:
        print(f"Critical error polling device {device_id}: {e}")
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
