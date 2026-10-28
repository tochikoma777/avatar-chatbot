from typing import Literal

from pydantic import BaseModel, Field

Role = Literal["system", "user", "assistant"]


class HistoryMessage(BaseModel):
    """前端回传的一轮历史消息。"""

    role: Role
    content: str = Field("", max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    persona_id: str | None = "sakura"
    system_prompt: str | None = Field(None, max_length=4000)
    history: list[HistoryMessage] = Field(default_factory=list)
    enable_tools: bool = True


class PersonaBrief(BaseModel):
    id: str
    name: str
    tagline: str
    greeting: str
    voice: dict = {}


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=500)
    style: str = "anime"
    width: int = Field(1280, ge=256, le=2048)
    height: int = Field(800, ge=256, le=2048)
    seed: int | None = None


class ImageResponse(BaseModel):
    image_data: str
    cached: bool = False
    fallback: bool = False
