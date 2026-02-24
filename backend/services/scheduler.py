import asyncio
from services.monitors import run_monitoring_cycle
from database import SessionLocal
from models.system_settings import SystemSettings
from config import settings

async def start_scheduler():
    print("Background Monitoring Scheduler initialized.")
    while True:
        try:
            await run_monitoring_cycle()
        except Exception as e:
            print(f"Error in monitoring cycle: {e}")
        
        # Fetch interval from db
        db = SessionLocal()
        try:
            sys_settings = db.query(SystemSettings).first()
            polling_interval = sys_settings.polling_interval if sys_settings else 60
        finally:
            db.close()

        await asyncio.sleep(polling_interval)

def register_scheduler():
    loop = asyncio.get_event_loop()
    loop.create_task(start_scheduler())
