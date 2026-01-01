from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title = "Network Device Monitoring System")

@app.get("/health")
def healthcheck():
    return {
        "status" : "ok",
        "timestamp" : datetime.utcnow(),
        "service" : "backend",
        "message" : "API is healthy and running"
    }


