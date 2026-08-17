from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    base_url: str | None
    api_key_env: str


PROVIDERS = {
    "openai": ProviderConfig("openai", None, "OPENAI_API_KEY"),
    "gemini": ProviderConfig("gemini", "https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY"),
    "nvidia": ProviderConfig("nvidia", "https://integrate.api.nvidia.com/v1", "NVIDIA_API_KEY"),
    "openrouter": ProviderConfig("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
}


def get_provider(name: str) -> ProviderConfig:
    try:
        return PROVIDERS[name.lower()]
    except KeyError as exc:
        raise ValueError(f"Unsupported provider: {name}") from exc
