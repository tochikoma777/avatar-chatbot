from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    system_prompt: str | None = None   # 可选，允许前端指定人设

class ChatResponse(BaseModel):
    reply: str