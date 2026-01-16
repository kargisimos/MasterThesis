from sqlalchemy.orm import Session
from models.device import Device
from models.user import User
from services.auditlogger import log_action
from services.email_service import send_email
import asyncio

# Thresholds
CPU_CRITICAL = 90.0
MEMORY_CRITICAL = 90.0
LATENCY_WARNING = 40.0

# Warning levels (for dashboard/logs only)
CPU_WARNING = 70.0
MEMORY_WARNING = 70.0

from database import SessionLocal

async def notify_users(subject: str, body: str):
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.receive_email_notifications == True).all()
        print(f"DEBUGGING: Found {len(users)} users that have enabled email notifications.")
        if users:
            emails = [u.email for u in users]
            print(f"DEBUGGING: Sending {subject} email to: {emails}")
            await send_email(subject, body, emails)
        else:
            print("DEBUGGING: No users found with email notifications enabled.")
    except Exception as e:
        print(f"DEBUGGING ERROR in notify_users: {e}")
    finally:
        db.close()

async def check_for_alerts(db: Session, device: Device) -> list[str]:
    critical_alerts = []

    # 1. Host Offline (Critical)
    if device.last_status == "offline":
        log_action(
            db=db,
            action="alert_critical_offline",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )
        critical_alerts.append(
            f"Device {device.name} is OFFLINE: The device {device.name} ({device.ip_address}) is currently unreachable via ICMP."
        )
        return critical_alerts
    
    # 2. Authentication Failures (Critical)
    # Checks the last_error field which might contain "Auth Failed" or other errors.
    
    if device.last_error:
        err = device.last_error.lower()
        is_ssh_error = "ssh" in err
        is_snmp_error = "snmp" in err
        is_auth_error = "auth failed" in err
        
        if is_auth_error or is_ssh_error or is_snmp_error:
            if is_auth_error:
                action_type = "alert_critical_auth_failure"
            elif is_ssh_error:
                action_type = "alert_critical_ssh_error"
            else:
                action_type = "alert_critical_snmp_error"
            
            log_action(
                db=db,
                action=action_type,
                actor_email="system@monitor",
                target_type="device",
                target_name=device.name
            )
            critical_alerts.append(
                f"Critical Error on {device.name}: {device.last_error} ({device.ip_address})"
            )

    # 3. CPU Usage
    if device.last_cpu:
        if device.last_cpu > CPU_CRITICAL:
            log_action(
                db=db,
                action="alert_critical_cpu",
                actor_email="system@monitor",
                target_type="device",
                target_name=device.name
            )
            critical_alerts.append(
                f"High CPU on {device.name}: Device {device.name} ({device.ip_address}) CPU usage is at {device.last_cpu}%."
            )
        elif device.last_cpu > CPU_WARNING:
            log_action(
                db=db,
                action="alert_warning_cpu",
                actor_email="system@monitor",
                target_type="device",
                target_name=device.name
            )

    # 4. Memory Usage
    if device.last_memory:
        if device.last_memory > MEMORY_CRITICAL:
            log_action(
                db=db,
                action="alert_critical_memory",
                actor_email="system@monitor",
                target_type="device",
                target_name=device.name
            )
            critical_alerts.append(
                f"High Memory on {device.name}: Device {device.name} ({device.ip_address}) Memory usage is at {device.last_memory}%."
            )
        elif device.last_memory > MEMORY_WARNING:
            log_action(
                db=db,
                action="alert_warning_memory",
                actor_email="system@monitor",
                target_type="device",
                target_name=device.name
            )

    # 5. Latency (Warning)
    if device.last_latency and device.last_latency > LATENCY_WARNING:
        log_action(
            db=db,
            action="alert_warning_latency",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )

    return critical_alerts
