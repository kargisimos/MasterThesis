import base64
import hashlib
from cryptography.fernet import Fernet
from config import settings


def _derive_key(secret: str) -> bytes:
    """
    Derive a stable Fernet key from an environment secret.
    """
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_derive_key(settings.DEVICE_CREDENTIAL_SECRET_KEY))


def encrypt_value(value: str | None) -> str | None:
    """
    Encrypt a sensitive value for storage.
    """
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt_value(value: str | None) -> str | None:
    """
    Decrypt a sensitive value for runtime usage.
    """
    if value is None:
        return None
    return _fernet.decrypt(value.encode()).decode()
