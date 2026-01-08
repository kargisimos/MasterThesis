from pydantic import BaseModel, Field, IPvAnyAddress
from typing import Optional, Literal


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

    class Config:
        orm_mode = True



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
