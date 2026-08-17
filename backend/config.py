from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    nvidia_api_key: str | None = None
    openrouter_api_key: str | None = None
    port: int = 8080
    aman_default_provider: str = "openai"


settings = Settings()
