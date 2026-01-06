from sqlalchemy.orm import Session
from models.auditlog import AuditLog

def log_action(
    db: Session,
    *,
    action: str,
    actor_email: str,
    target_type: str,
    target_name: str = None,
):
    """
    Logs a human-readable action in the audit_logs table.

    Parameters:
    - action: str, e.g., 'user_created', 'device_updated'
    - actor_email: str, email of the user performing the action
    - target_type: str, e.g., 'user', 'device', 'system'
    - target_name: str, optional, human-readable target identifier
    """
    log = AuditLog(
        action=action,
        actor_email=actor_email,
        target_type=target_type,
        target_name=target_name,
    )
    db.add(log)
    db.commit()
