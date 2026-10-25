from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+psycopg://fanatics:local-development-only@localhost:5432/fanatics"
    )
    firebase_project_id: str = "sports-fanatics-local"
    solver_timeout_seconds: float = 2.0
    worker_interval_seconds: float = 1.0

    app_name: str = "Sports Fanatics API"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
