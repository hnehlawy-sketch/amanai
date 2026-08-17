import os

from agents import Agent, Runner
from agents.models.multi_provider import MultiProvider

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

    if provider.base_url:
        return MultiProvider(use_for_tracing=True).get_model(
            model=f"{provider.name}/default",
            api_key=key,
            base_url=provider.base_url,
        )
    return MultiProvider().get_model(model="openai/gpt-5.2", api_key=key)


agent = Agent(
    name="AMAN",
    instructions=SYSTEM_INSTRUCTIONS,
    model=build_model(),
)


async def run_agent(message: str) -> str:
    result = await Runner.run(agent, message)
    return result.final_output
