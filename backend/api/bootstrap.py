from sqlalchemy.orm import Session
from models.user import User, UserRole
from models.system_settings import SystemSettings
from api.auth import get_password_hash
from config import settings


def create_default_admin(db: Session):
    user_exists = db.query(User).first()
    if not user_exists:
        admin = User(
            email=settings.DEFAULT_ADMIN_EMAIL,
            hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
            full_name=settings.DEFAULT_ADMIN_FULL_NAME,
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        db.commit()

    sys_settings = db.query(SystemSettings).first()
    if not sys_settings:
        sys_settings = SystemSettings()
        db.add(sys_settings)
        db.commit()
