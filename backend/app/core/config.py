import os
from dotenv import load_dotenv

from pydantic_settings import BaseSettings

load_dotenv()


class Config(BaseSettings):
    app_name: str = "NBA Fantasy Draft"

    db_type: str = os.getenv("DB_TYPE", "sqlite")
    db_user: str = os.getenv("DB_USER", None)
    db_password: str = os.getenv("DB_PASSWORD", None)
    db_host: str = os.getenv("DB_HOST", None)
    db_port: int = os.getenv("DB_PORT", None)
    db_name: str = os.getenv("DB_NAME", None)

    @property
    def construct_db_url(self):
        if self.db_type == "sqlite":
            return f"sqlite:///{self.db_name}.db"