import os

from agents import Agent, AsyncOpenAI, OpenAIChatCompletionsModel, Runner, set_tracing_disabled

from config import settings
from providers import get_provider


SYSTEM_INSTRUCTIONS = """
You are AMAN AI, a capable Arabic-first general assistant.

You are the master orchestrator. Understand the user's goal before acting.
Be concise when the task is simple and structured when the task is complex.
Do not claim that an action was completed unless a tool actually completed it.
Provider selection is an implementation detail; never expose API keys or secrets.
For image, file, web, coding, and realtime capabilities, use the corresponding
server tools when they are available.
""".strip()


def build_model():
    provider = get_provider(settings.aman_default_provider)
    key = os.getenv(provider.api_key_env)
    if not key:
        raise RuntimeError(f"Missing credential: {provider.api_key_env}")

    model_name = {
        "openai": settings.openai_model,
        "gemini": settings.gemini_model,
        "nvidia": settings.nvidia_model,
        "openrouter": settings.openrouter_model,
    }[provider.name]

    if provider.name == "openai":
        client = AsyncOpenAI(api_key=key)
        return OpenAIChatCompletionsModel(model=model_name, openai_client=client)

    client = AsyncOpenAI(api_key=key, base_url=provider.base_url)
    set_tracing_disabled(True)
    return OpenAIChatCompletionsModel(model=model_name, openai_client=client)


agent = Agent(name="AMAN", instructions=SYSTEM_INSTRUCTIONS, model=build_model())


async def run_agent(message: str) -> str:
    result = await Runner.run(agent, message)
    return result.final_output
