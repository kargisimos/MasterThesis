from sqlalchemy.orm import Session
from models.user import User, UserRole
from api.auth import get_password_hash
from config import settings


def create_default_admin(db: Session):
    user_exists = db.query(User).first()
    if user_exists:
        return

    admin = User(
        email=settings.DEFAULT_ADMIN_EMAIL,
        hashed_password=get_password_hash(settings.DEFAULT_ADMIN_PASSWORD),
        full_name=settings.DEFAULT_ADMIN_FULL_NAME,
        role=UserRole.admin,
        is_active=True,
    )

    db.add(admin)
    db.commit()
