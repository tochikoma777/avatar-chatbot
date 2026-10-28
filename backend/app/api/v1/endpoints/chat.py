from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_chat_service
from app.core.models import ChatRequest
from app.core.services import ChatService

router = APIRouter()


@router.post("/chat")
async def chat(
    request: ChatRequest,
    service: ChatService = Depends(get_chat_service),
):
    """流式对话（SSE）。前端携带历史消息以实现多轮上下文。"""
    return StreamingResponse(
        service.stream_chat(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
