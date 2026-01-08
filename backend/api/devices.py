from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from models.device import Device, DeviceCredential
from schemas.device import DeviceCreate, DeviceOut, DeviceUpdate, CredentialCreate, CredentialOut
from services.auditlogger import log_action
from services.encryptor import encrypt_value
from api.auth import get_db
from api.users import get_current_user

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
