from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
import math

from database import SessionLocal
from models.auditlog import AuditLog
from schemas.auditlog import AuditLogOut, AuditLogPage
from api.users import get_current_user
from models.user import User, UserRole

router = APIRouter(tags = ["Audit Logs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=AuditLogPage)
def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    total_logs = db.query(AuditLog).count()
    total_pages = math.ceil(total_logs / page_size)

    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogPage(
        logs=[
            AuditLogOut(
                id=log.id,
                timestamp=log.timestamp.isoformat(),
                actor_email=log.actor_email,
                action=log.action,
                target_name=log.target_name
            )
            for log in logs
        ],
        total_pages=total_pages
    )
