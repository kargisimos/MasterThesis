from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from models.device import Device, DeviceCredential, DeviceMetric
from schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, CredentialCreate, CredentialOut, MetricOut, TrendOut
from services.auditlogger import log_action
from services.encryptor import encrypt_value
from services.db import get_db
from services.security import get_current_user

router = APIRouter(tags=["Devices"])


@router.post("/", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    device_in: DeviceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    device = Device(
        name=device_in.name,
        ip_address=str(device_in.ip_address),
        type=device_in.type,
        manufacturer=device_in.manufacturer,
        model=device_in.model,
        location=device_in.location,
        notes=device_in.notes,
        is_active=device_in.is_active,
    )

    db.add(device)
    db.commit()
    db.refresh(device)

    log_action(
        db=db,
        action="device_created",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    return device


@router.get("/", response_model=List[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(Device).all()


@router.get("/stats/trends", response_model=List[TrendOut])
def get_network_trends(
    range: str = "24h",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get aggregated network trends over a specific timeframe.
    Supported ranges: "24h", "7d", "30d"
    """
    if current_user.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from sqlalchemy import func
    from datetime import datetime, timedelta

    # Calculate start time based on range
    start_time = datetime.utcnow() - timedelta(hours=24)
    if range == "7d":
        start_time = datetime.utcnow() - timedelta(days=7)
    elif range == "30d":
        start_time = datetime.utcnow() - timedelta(days=30)
    
    # Simple limit adjustment for different ranges
    limit_pts = 50 if range == "24h" else 100

    results = (
        db.query(
            DeviceMetric.timestamp,
            func.avg(DeviceMetric.cpu_usage).label("avg_cpu"),
            func.avg(DeviceMetric.memory_usage).label("avg_memory"),
            func.avg(DeviceMetric.latency).label("avg_latency"),
            func.avg(DeviceMetric.traffic).label("avg_traffic"),
        )
        .filter(DeviceMetric.timestamp >= start_time)
        .group_by(DeviceMetric.timestamp)
        .order_by(DeviceMetric.timestamp.desc())
        .limit(limit_pts)
        .all()
    )

    return [
        TrendOut(
            timestamp=r.timestamp, 
            avg_cpu=float(r.avg_cpu or 0), 
            avg_memory=float(r.avg_memory or 0), 
            avg_latency=float(r.avg_latency or 0),
            avg_traffic=float(r.avg_traffic or 0)
        ) 
        for r in reversed(results)
    ]


@router.patch("/{device_id}", response_model=DeviceOut)
def update_device(
    device_id: int,
    device_in: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    for field, value in device_in.dict(exclude_unset=True).items():
        if field == "ip_address":
            setattr(device, field, str(value))
        else:
            setattr(device, field, value)

    db.commit()
    db.refresh(device)

    log_action(
        db=db,
        action="device_updated",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(device)
    db.commit()

    log_action(
        db=db,
        action="device_deleted",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    return



@router.post("/{device_id}/credentials", response_model=CredentialOut)
def create_or_update_credential(
    device_id: int,
    cred_in: CredentialCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Encrypt sensitive fields
    if cred_in.type == "ssh":
        username_enc = encrypt_value(cred_in.username)
        password_enc = encrypt_value(cred_in.password)
        community_enc = None
    elif cred_in.type == "snmp":
        username_enc = None
        password_enc = None
        community_enc = encrypt_value(cred_in.community_string)
    else:
        raise HTTPException(status_code=400, detail="Invalid credential type")

    cred = (
        db.query(DeviceCredential)
        .filter(DeviceCredential.device_id == device_id, DeviceCredential.type == cred_in.type)
        .first()
    )

    if cred:
        cred.username = username_enc
        cred.password = password_enc
        cred.community_string = community_enc
    else:
        cred = DeviceCredential(
            device_id=device_id,
            type=cred_in.type,
            username=username_enc,
            password=password_enc,
            community_string=community_enc,
        )
        db.add(cred)

    db.commit()
    db.refresh(cred)

    log_action(
        db=db,
        action=f"{cred_in.type}_credential_stored",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    return CredentialOut(
        device_id=device_id,
        type=cred.type,
    )

@router.get("/{device_id}/history", response_model=List[MetricOut])
def get_device_history(
    device_id: int,
    range: str = "24h",
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    from datetime import datetime, timedelta
    
    start_time = datetime.utcnow() - timedelta(hours=24)
    if range == "7d":
        start_time = datetime.utcnow() - timedelta(days=7)
        limit = 500
    elif range == "30d":
        start_time = datetime.utcnow() - timedelta(days=30)
        limit = 1000

    return (
        db.query(DeviceMetric)
        .filter(DeviceMetric.device_id == device_id, DeviceMetric.timestamp >= start_time)
        .order_by(DeviceMetric.timestamp.desc())
        .limit(limit)
        .all()
    )


