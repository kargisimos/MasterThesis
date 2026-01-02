from fastapi import FastAPI
from database import Base, engine
from api import health, auth
import models.user

app = FastAPI(title="Network Device Monitoring System")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind = engine)


app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
