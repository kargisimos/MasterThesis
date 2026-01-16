from sqlalchemy import Column, Integer, String, Boolean, Enum
from database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default = "viewer", nullable = False)
    is_active = Column(Boolean, default=True)
    receive_email_notifications = Column(Boolean, default=False)
