from sqlalchemy import Column, Integer, String, Boolean, Enum
from database import Base
import enum

class DeviceType(str, enum.Enum):
    router = "router"
    switch = "switch"
    server = "server"
    iot = "iot"

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ip_address = Column(String, nullable=False)
    type = Column(String, nullable=False)
    manufacturer = Column(String, nullable=True)
    model = Column(String, nullable=True)
    location = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
