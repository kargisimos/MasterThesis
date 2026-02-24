from sqlalchemy import Column, Integer, Float
from database import Base

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    polling_interval = Column(Integer, default=60)
    cpu_warning_threshold = Column(Float, default=70.0)
    cpu_critical_threshold = Column(Float, default=90.0)
    memory_warning_threshold = Column(Float, default=70.0)
    memory_critical_threshold = Column(Float, default=90.0)
    latency_warning_threshold = Column(Float, default=40.0)
