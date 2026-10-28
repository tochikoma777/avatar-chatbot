"""FastAPI 依赖注入：复用重量级对象（客户端、缓存等）。"""

from app.core.image_gen import ImageGenerator
from app.core.services import ChatService

_chat_service: ChatService | None = None
_image_generator: ImageGenerator | None = None


def get_chat_service() -> ChatService:
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service


def get_image_generator() -> ImageGenerator:
    global _image_generator
    if _image_generator is None:
        _image_generator = ImageGenerator()
    return _image_generator
