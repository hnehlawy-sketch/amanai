# AMAN AI Agent Backend

Initial architecture for the AMAN multi-provider agent backend.

## Goals

- OpenAI Agents SDK as the orchestration layer.
- Provider gateway for OpenAI, Gemini, NVIDIA and OpenRouter.
- Keep provider secrets server-side only.
- HTTP API with `/health` and `/v1/chat`.
- Provider selection is policy-driven and can fall back safely.
- Realtime voice will be added through a dedicated WebRTC session endpoint.
- Image generation/editing/upscaling will be exposed as explicit tools.

This first slice intentionally contains no provider secrets and does not bypass provider geographic restrictions. Deployment regions should be selected according to each provider's terms and availability.

## Environment

Copy the variable names from `.env.example` into the deployment environment. Never commit real keys.

## Local smoke test

The backend is designed to run with `uv run python main.py` when `PORT` is present.
