from pydantic import BaseModel, Field, IPvAnyAddress
from typing import Optional, Literal
from datetime import datetime

DeviceType = Literal["Router", "Switch", "Server", "IoT Device"]

class DeviceBase(BaseModel):
    name: str = Field(..., example="Office Router")
    type: DeviceType = Field(..., example="Router")
    ip_address: IPvAnyAddress = Field(..., example="192.168.1.1")
    manufacturer: Optional[str] = Field(None, example="Cisco")
    model: Optional[str] = Field(None, example="RV340")
    location: Optional[str] = Field(None, example="Data Center Rack 3")
    notes: Optional[str] = Field(None, example="Main office router")
    is_active: Optional[bool] = True

class DeviceCreate(DeviceBase):
    pass  # same as DeviceBase

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[DeviceType] = None
    ip_address: Optional[IPvAnyAddress] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class DeviceOut(DeviceBase):
    id: int
    
    last_status: str
    last_latency: Optional[float] = None
    last_cpu: Optional[float] = None
    last_memory: Optional[float] = None
    last_traffic: Optional[float] = None
    last_polled: Optional[datetime] = None

    class Config:
        orm_mode = True

class MetricOut(BaseModel):
    id: int
    device_id: int
    timestamp: datetime
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    traffic: Optional[float] = None
    latency: Optional[float] = None

    class Config:
        orm_mode = True
class TrendOut(BaseModel):
    timestamp: datetime
    avg_cpu: float
    avg_memory: float
    avg_latency: float
    avg_traffic: float

CredentialType = Literal["ssh", "snmp"]

class CredentialBase(BaseModel):
    type: CredentialType

class CredentialCreate(CredentialBase):
    username: Optional[str] = None
    password: Optional[str] = None
    community_string: Optional[str] = None

class CredentialOut(CredentialBase):
    device_id: int

    class Config:
        orm_mode = True
