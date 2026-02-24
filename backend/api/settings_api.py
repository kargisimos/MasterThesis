from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt

from models.system_settings import SystemSettings
from schemas.system_settings import SystemSettingsUpdate, SystemSettingsResponse
from config import settings
from services.auditlogger import log_action
from services.db import get_db
from services.security import oauth2_scheme

router = APIRouter(
    tags=["Settings"]
)

@router.get("/", response_model=SystemSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    sys_settings = db.query(SystemSettings).first()
    if not sys_settings:
        sys_settings = SystemSettings()
        db.add(sys_settings)
        db.commit()
        db.refresh(sys_settings)
    return sys_settings


@router.patch("/", response_model=SystemSettingsResponse)
def update_settings(
    settings_update: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        payload_jwt = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        current_user_email: str | None = payload_jwt.get("sub")
        current_user_role: str | None = payload_jwt.get("role")
        if current_user_email is None or current_user_role != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    sys_settings = db.query(SystemSettings).first()
    if not sys_settings:
        sys_settings = SystemSettings()
        db.add(sys_settings)

    update_data = settings_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sys_settings, key, value)
    
    db.commit()
    db.refresh(sys_settings)

    log_action(
        db=db,
        action="settings_updated",
        actor_email=current_user_email,
        target_type="system",
        target_name="system_settings"
    )

    return sys_settings
