import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent import run_agent

app = FastAPI(title="AMAN AI Backend", version="0.1.0")


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    output: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "aman-ai"}


@app.post("/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        return ChatResponse(output=await run_agent(request.message))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8080")))
