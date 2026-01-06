from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_email = Column(String, nullable=False)
    action = Column(String, nullable=False)
    target_type = Column(String, nullable=True)
    target_name = Column(String, nullable=True)
