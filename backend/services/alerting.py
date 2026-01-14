from sqlalchemy.orm import Session
from models.device import Device
from services.auditlogger import log_action

CPU_CRITICAL = 80.0
MEMORY_WARNING = 85.0
LATENCY_WARNING = 40.0

def check_for_alerts(db: Session, device: Device):
    if device.last_status == "offline":
        log_action(
            db=db,
            action="alert_critical_offline",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )
        return 

    if device.last_cpu and device.last_cpu > CPU_CRITICAL:
        log_action(
            db=db,
            action="alert_critical_cpu",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )

    if device.last_memory and device.last_memory > MEMORY_WARNING:
        log_action(
            db=db,
            action="alert_warning_memory",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )

    if device.last_latency and device.last_latency > LATENCY_WARNING:
        log_action(
            db=db,
            action="alert_warning_latency",
            actor_email="system@monitor",
            target_type="device",
            target_name=device.name
        )
