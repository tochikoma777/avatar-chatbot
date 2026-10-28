from fastapi import APIRouter
from app.api.v1.endpoints import chat, generate, health, personas

router = APIRouter()
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(health.router, prefix="/health", tags=["health"])
router.include_router(generate.router, prefix="/generate", tags=["generate"])
router.include_router(personas.router, prefix="/personas", tags=["personas"])
