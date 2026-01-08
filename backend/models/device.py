from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
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

    credentials = relationship(
        "DeviceCredential",
        back_populates="device",
        cascade="all, delete-orphan"
    )


class DeviceCredential(Base):
    __tablename__ = "device_credentials"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    type = Column(String, nullable=False)  # 'ssh' or 'snmp'
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    community_string = Column(String, nullable=True)

    device = relationship("Device", back_populates="credentials")
