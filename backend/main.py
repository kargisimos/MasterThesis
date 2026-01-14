from fastapi import FastAPI
from database import Base, engine, SessionLocal
from api import health, auth, users, auditlogs, devices, websocket
from api.bootstrap import create_default_admin
from services.scheduler import register_scheduler
from services.redis_service import redis_service
import models.user
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI(title="Network Device Monitoring System")

# Store background tasks
background_tasks = set()

@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        create_default_admin(db)
    finally:
        db.close()
    
    # Start the monitoring engine
    register_scheduler()
    
    # Start Redis subscriber for real-time updates
    task = asyncio.create_task(redis_service.subscribe_and_forward())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)
    print("✓ Redis subscriber task started")

@app.on_event("shutdown")
def on_shutdown():
    """Graceful shutdown of Redis connections"""
    redis_service.disconnect()
    print("✓ Application shutdown complete")



origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(users.router, prefix="/users")
app.include_router(auditlogs.router, prefix="/auditlogs")
app.include_router(devices.router, prefix="/devices")
app.include_router(websocket.router)


