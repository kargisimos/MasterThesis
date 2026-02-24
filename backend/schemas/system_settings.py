from pydantic import BaseModel
from typing import Optional

class SystemSettingsBase(BaseModel):
    polling_interval: Optional[int] = None
    cpu_warning_threshold: Optional[float] = None
    cpu_critical_threshold: Optional[float] = None
    memory_warning_threshold: Optional[float] = None
    memory_critical_threshold: Optional[float] = None
    latency_warning_threshold: Optional[float] = None

class SystemSettingsUpdate(SystemSettingsBase):
    pass

class SystemSettingsResponse(SystemSettingsBase):
    id: int
    polling_interval: int
    cpu_warning_threshold: float
    cpu_critical_threshold: float
    memory_warning_threshold: float
    memory_critical_threshold: float
    latency_warning_threshold: float

    class Config:
        orm_mode = True
