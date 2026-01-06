from pydantic import BaseModel
from typing import List

class AuditLogOut(BaseModel):
    id: int
    timestamp: str
    actor_email: str
    action: str
    target_name: str | None

class AuditLogPage(BaseModel):
    logs: List[AuditLogOut]
    total_pages: int
