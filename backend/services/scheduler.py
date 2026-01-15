import asyncio
from services.monitors import run_monitoring_cycle
from config import settings

async def start_scheduler():
    print("Background Monitoring Scheduler initialized.")
    while True:
        try:
            await run_monitoring_cycle()
        except Exception as e:
            print(f"Error in monitoring cycle: {e}")
        
        await asyncio.sleep(settings.POLLING_INTERVAL)

def register_scheduler():
    loop = asyncio.get_event_loop()
    loop.create_task(start_scheduler())
