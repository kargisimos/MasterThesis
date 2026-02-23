from typing import List
from datetime import datetime, timedelta
import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text, literal_column
from sqlalchemy.orm import Session

from models.device import Device, DeviceCredential, DeviceMetric
from schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, CredentialCreate, CredentialOut, MetricOut, TrendOut
from services.auditlogger import log_action
from services.encryptor import encrypt_value
from services.db import get_db
from services.security import get_current_user
from api.websocket import manager
from services.export_service import export_to_csv
from fastapi.responses import Response, StreamingResponse

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
    device.configured_credentials = []
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

    devices = db.query(Device).all()
    for device in devices:
        creds = []
        for c in device.credentials:
            # We store None for blank fields in the DB, so truthy check works even for encrypted values
            if c.type == "ssh":
                if c.username and c.password:
                    creds.append("ssh")
            elif c.type == "snmp":
                if c.community_string:
                    creds.append("snmp")
        device.configured_credentials = creds
    return devices


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

    # Calculate start time and interval based on range
    now = datetime.utcnow()
    if range == "7d":
        start_time = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        bucket_expr = func.date_trunc('day', DeviceMetric.timestamp)
    elif range == "30d":
        start_time = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        bucket_expr = func.date_trunc('day', DeviceMetric.timestamp)
    else:
        start_time = now - timedelta(hours=24)
        # 300 seconds = 5 minutes
        bucket_expr = literal_column("to_timestamp(floor(extract(epoch from timestamp) / 300) * 300)")

    results = (
        db.query(
            bucket_expr.label("bucket"),
            func.avg(DeviceMetric.cpu_usage).label("avg_cpu"),
            func.avg(DeviceMetric.memory_usage).label("avg_memory"),
            func.avg(DeviceMetric.latency).label("avg_latency"),
            func.avg(DeviceMetric.traffic).label("avg_traffic"),
        )
        .filter(DeviceMetric.timestamp >= start_time)
        .group_by(text("bucket"))
        .order_by(text("bucket ASC"))
        .all()
    )

    return [
        TrendOut(
            timestamp=r.bucket, 
            avg_cpu=float(r.avg_cpu or 0), 
            avg_memory=float(r.avg_memory or 0), 
            avg_latency=float(r.avg_latency or 0),
            avg_traffic=float(r.avg_traffic or 0)
        ) 
        for r in results
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
    creds = []
    for c in device.credentials:
        if c.type == "ssh" and c.username and c.password:
            creds.append("ssh")
        elif c.type == "snmp" and c.community_string:
            creds.append("snmp")
    device.configured_credentials = creds
    log_action(
        db=db,
        action="device_updated",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    return device


@router.get("/export")
def export_devices(
    format: str = "csv",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    devices = db.query(Device).all()
    
    export_data = []
    for d in devices:
        export_data.append({
            "id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "type": d.type,
            "location": d.location,
            "status": d.last_status,
            "is_active": d.is_active,
            "cpu_usage": d.last_cpu,
            "memory_usage": d.last_memory,
            "traffic": d.last_traffic,
            "latency": d.last_latency,
            "last_polled": d.last_polled.isoformat() if d.last_polled else None,
            "last_error": d.last_error
        })

    if format == "json":
        summary = {
            "total_devices": len(devices),
            "active_devices": len([d for d in devices if d.is_active]),
            "online_devices": len([d for d in devices if d.last_status == "online"]),
            "timestamp": datetime.utcnow().isoformat()
        }
        return {"summary": summary, "devices": export_data}

    headers = ["id", "name", "ip_address", "type", "location", "status", "is_active", "cpu_usage", "memory_usage", "traffic", "latency", "last_polled", "last_error"]
    csv_content = export_to_csv(export_data, headers)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=devices_inventory.csv"}
    )


@router.get("/{device_id}/history/export")
def export_device_history(
    device_id: int,
    format: str = "csv",
    range: str = "24h",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator", "viewer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Reuse existing history fetching logic or query directly
    # Here we query directly to avoid schema conflicts in export
    metrics = (
        db.query(DeviceMetric)
        .filter(DeviceMetric.device_id == device_id)
        .order_by(DeviceMetric.timestamp.desc())
        .all()
    )

    export_data = []
    for m in metrics:
        export_data.append({
            "timestamp": m.timestamp.isoformat(),
            "cpu_usage": m.cpu_usage,
            "memory_usage": m.memory_usage,
            "traffic": m.traffic,
            "latency": m.latency
        })

    if format == "json":
        return export_data

    headers = ["timestamp", "cpu_usage", "memory_usage", "traffic", "latency"]
    csv_content = export_to_csv(export_data, headers)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=device_{device_id}_history.csv"}
    )


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
async def create_or_update_credential(
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

    # Treat empty strings as None before encryption
    ssh_u = cred_in.username if cred_in.username else None
    ssh_p = cred_in.password if cred_in.password else None
    snmp_c = cred_in.community_string if cred_in.community_string else None

    # Encrypt sensitive fields
    if cred_in.type == "ssh":
        username_enc = encrypt_value(ssh_u)
        password_enc = encrypt_value(ssh_p)
        community_enc = None
    elif cred_in.type == "snmp":
        username_enc = None
        password_enc = None
        community_enc = encrypt_value(snmp_c)
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

    # If the new credential is blank, clear its "failing" state in the device model
    # so it immediately turns Gray in the UI and stops alerting.
    is_blank = False
    if cred_in.type == "ssh" and (not cred_in.username or not cred_in.password):
        is_blank = True
    elif cred_in.type == "snmp" and not cred_in.community_string:
        is_blank = True

    if is_blank:
        try:
            failing = json.loads(device.failing_protocols or "[]")
            if cred_in.type in failing:
                failing.remove(cred_in.type)
                device.failing_protocols = json.dumps(failing)
                # Also clean up last_error if it contains this protocol
                if device.last_error:
                    parts = [p.strip() for p in device.last_error.split("&")]
                    new_parts = [p for p in parts if not p.upper().startswith(cred_in.type.upper())]
                    device.last_error = " & ".join(new_parts) if new_parts else None
                db.commit()
        except Exception as e:
            print(f"Error clearing failing state: {e}")

    log_action(
        db=db,
        action=f"{cred_in.type}_credential_stored",
        actor_email=current_user.email,
        target_type="device",
        target_name=device.name,
    )

    db.refresh(device)
    # BROADCAST the update immediately
    conf_creds = []
    for c in device.credentials:
        if c.type == "ssh" and c.username and c.password:
            conf_creds.append("ssh")
        elif c.type == "snmp" and c.community_string:
            conf_creds.append("snmp")
            
    try:
        await manager.broadcast({
            "type": "device_update",
            "device": {
                "id": device.id,
                "name": device.name,
                "ip_address": device.ip_address,
                "last_status": device.last_status,
                "last_latency": device.last_latency,
                "last_cpu": device.last_cpu,
                "last_memory": device.last_memory,
                "last_traffic": device.last_traffic,
                "last_polled": device.last_polled.isoformat() if device.last_polled else None,
                "last_error": device.last_error,
                "failing_protocols": device.failing_protocols,
                "configured_credentials": conf_creds
            }
        })
    except Exception as e:
        print(f"Error broadcasting credential update: {e}")

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

    now = datetime.utcnow()

    if range == "7d":
        start_time = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        interval = "1 day"
    elif range == "30d":
        start_time = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        interval = "1 day"
    else:
        return (
            db.query(DeviceMetric)
            .filter(DeviceMetric.device_id == device_id, DeviceMetric.timestamp >= (now - timedelta(hours=24)))
            .order_by(DeviceMetric.timestamp.desc())
            .limit(limit)
            .all()
        )

    # For 7d/30d use generate_series to provide "calendar" view
    sql = text("""
        SELECT 
            series.bucket,
            COALESCE(AVG(m.cpu_usage), 0) as cpu_usage,
            COALESCE(AVG(m.memory_usage), 0) as memory_usage,
            COALESCE(AVG(m.latency), 0) as latency,
            COALESCE(AVG(m.traffic), 0) as traffic
        FROM generate_series(:start_time, :now, :interval::interval) AS series(bucket)
        LEFT JOIN device_metrics m ON 
            date_trunc('day', m.timestamp) = series.bucket AND 
            m.device_id = :device_id
        GROUP BY series.bucket
        ORDER BY series.bucket DESC
    """)

    results = db.execute(sql, {
        "start_time": start_time,
        "now": now,
        "interval": interval,
        "device_id": device_id
    }).all()

    # Use a dummy ID for the bucketed results
    return [
        MetricOut(
            id=0,
            device_id=device_id,
            timestamp=r.bucket,
            cpu_usage=float(r.cpu_usage or 0),
            memory_usage=float(r.memory_usage or 0),
            latency=float(r.latency or 0),
            traffic=float(r.traffic or 0)
        )
        for r in results
    ]

# --- Active Device Management ---

from services.ssh_manager import get_running_services, restart_service, reboot_device
from services.encryptor import decrypt_value

def _get_ssh_credentials(db: Session, device_id: int):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    ssh_cred = next((c for c in device.credentials if c.type == "ssh"), None)
    if not ssh_cred or not ssh_cred.username or not ssh_cred.password:
        raise HTTPException(status_code=400, detail="Device does not have SSH credentials configured")
        
    u = decrypt_value(ssh_cred.username)
    p = decrypt_value(ssh_cred.password)
    if not u or not p:
        raise HTTPException(status_code=400, detail="Invalid SSH credentials")
        
    return device, u, p

@router.get("/{device_id}/services")
async def list_device_services(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    device, username, password = _get_ssh_credentials(db, device_id)
    
    try:
        services = await get_running_services(device.ip_address, username, password)
        return services
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{device_id}/services/{service_name}/restart")
async def process_restart_service(
    device_id: int,
    service_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    device, username, password = _get_ssh_credentials(db, device_id)
    
    try:
        await restart_service(device.ip_address, username, password, service_name)
        log_action(
            db=db,
            action="service_restarted",
            actor_email=current_user.email,
            target_type="device",
            target_name=device.name,
            # 'details' is not supported by the current log_action implementation
        )
        return {"status": "success", "message": f"Service {service_name} restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{device_id}/reboot")
async def process_reboot_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    device, username, password = _get_ssh_credentials(db, device_id)
    
    try:
        await reboot_device(device.ip_address, username, password)
        log_action(
            db=db,
            action="device_rebooted",
            actor_email=current_user.email,
            target_type="device",
            target_name=device.name
        )
        return {"status": "success", "message": "Reboot initiated"}
    except Exception as e:
        # A timeout exception is expected when rebooting due to dropped connection,
        # so ssh_manager.reboot_device returns True instead of raising.
        # So if we reach here, it's a real failure.
        raise HTTPException(status_code=500, detail=str(e))



