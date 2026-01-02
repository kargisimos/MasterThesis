from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags = ["Health"])

@router.get("/health")
def healthcheck():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow(),
        "service": "backend",
        "message": "API is healthy and running"
    }
