from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: int

    DEFAULT_ADMIN_EMAIL: str
    DEFAULT_ADMIN_PASSWORD: str
    DEFAULT_ADMIN_FULL_NAME: str

    DEVICE_CREDENTIAL_SECRET_KEY: str
    
    REDIS_HOST: str
    REDIS_PORT: int
    
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAIL_FROM: str


    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
