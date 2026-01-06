from fastapi import FastAPI
from database import Base, engine, SessionLocal
from api import health, auth, users, auditlogs
from api.bootstrap import create_default_admin
import models.user
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Network Device Monitoring System")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        create_default_admin(db)
    finally:
        db.close()


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

