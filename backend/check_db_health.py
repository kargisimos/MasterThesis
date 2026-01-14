from database import SessionLocal
from models.device import Device, DeviceMetric
from datetime import datetime, timedelta

def check_health():
    db = SessionLocal()
    try:
        device_count = db.query(Device).count()
        metric_count = db.query(DeviceMetric).count()
        recent_metrics = db.query(DeviceMetric).filter(DeviceMetric.timestamp > datetime.utcnow() - timedelta(minutes=5)).count()
        
        print(f"Total Devices: {device_count}")
        print(f"Total Metrics Stored: {metric_count}")
        print(f"Metrics in last 5 minutes: {recent_metrics}")
        
        if recent_metrics > 0:
            print("STATUS: Monitoring Engine is ACTIVE and producing data.")
        else:
            print("STATUS: Monitoring Engine appears INACTIVE or no active devices.")
    finally:
        db.close()

if __name__ == "__main__":
    check_health()
