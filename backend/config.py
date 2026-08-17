from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str | None = None
    openai_model: str = "gpt-5.2"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    nvidia_api_key: str | None = None
    nvidia_model: str = "meta/llama-3.3-70b-instruct"
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-5.2"
    port: int = 8080
    aman_default_provider: str = "openai"


settings = Settings()
