from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.models import ChatRequest
from app.core.services import ChatService

router = APIRouter()
chat_service = ChatService()

@router.post("/chat")
async def chat(request: ChatRequest):
    # 如果用户没有提供人设，使用默认的“温柔学姐”人设
    system_prompt = request.system_prompt or "你是一个温柔、耐心的学姐，总是乐于帮助和指导学弟学妹。你的回答简洁、清晰，带有一点可爱。"
    
    return StreamingResponse(
        chat_service.stream_chat(request.message, system_prompt),
        media_type="text/event-stream",   # 告诉浏览器这是流式数据
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",    # 禁用Nginx缓冲（若使用）
        }
    )