from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt

from models.user import User, PasswordResetToken
from schemas.user import (
    UserLogin, 
    UserCreate, 
    Token, 
    ChangePasswordRequest, 
    ForgotPasswordRequest, 
    ResetPasswordRequest
)
from config import settings
from services.auditlogger import log_action
from services.db import get_db
from services.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    oauth2_scheme,
    validate_password_policy
)
from services.email_service import send_email
import secrets

router = APIRouter(
    tags=["Auth"]
)


@router.post("/login", response_model=Token)
def login(
    user: UserLogin,
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user or not verify_password(
        user.password, db_user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        {"sub": db_user.email, "role": db_user.role}
    )
    refresh_token = create_refresh_token(
        {"sub": db_user.email}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
def refresh_token(
    payload: dict,
    db: Session = Depends(get_db),
):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )

    try:
        jwt_payload = jwt.decode(
            refresh_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        if jwt_payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        email: str | None = jwt_payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    new_access_token = create_access_token(
        {"sub": user.email, "role": user.role}
    )

    return {
        "access_token": new_access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserCreate)
def register(user: UserCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):

    try:
        payload_jwt = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        current_user_email: str | None = payload_jwt.get("sub")
        current_user_role: str | None = payload_jwt.get("role")
        if current_user_email is None or current_user_role != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    validate_password_policy(user.password)
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        full_name=user.full_name,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    log_action(
        db=db,
        action="user_created",
        actor_email=current_user_email,
        target_type="user",
        target_name=db_user.email
    )

    return user



@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    try:
        payload_jwt = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        current_user_email: str | None = payload_jwt.get("sub")
        if current_user_email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == current_user_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    validate_password_policy(payload.new_password)
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    log_action(
        db=db,
        action="password_changed",
        actor_email=current_user_email,
        target_type="user",
        target_name=current_user_email
    )

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user:
        return {"message": "If an account exists for this email, a reset link has been sent."}

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()

    reset_link = f"http://localhost:5173/reset-password?token={token}"
    email_content = f"""
    <html>
        <body>
            <h3>Password Reset Request</h3>
            <p>Hello {user.full_name},</p>
            <p>We received a request to reset your password. Click the link below to set a new one:</p>
            <p><a href="{reset_link}">{reset_link}</a></p>
            <p>This link will expire in 30 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        </body>
    </html>
    """
    
    try:
        await send_email(
            subject="Password Reset - Network Monitoring System",
            content=email_content,
            to_emails=[user.email],
            is_html=True
        )
    except Exception as e:
        print(f"Failed to send reset email: {e}")

    return {"message": "If an account exists for this email, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    
    if not reset_token or reset_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    user = reset_token.user
    
    validate_password_policy(payload.new_password)
    user.hashed_password = get_password_hash(payload.new_password)
    
    # Delete the token after use
    db.delete(reset_token)
    db.commit()

    log_action(
        db=db,
        action="password_reset_success",
        actor_email=user.email,
        target_type="user",
        target_name=user.email
    )

    return
