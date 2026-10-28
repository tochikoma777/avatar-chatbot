from fastapi import APIRouter

from app.config import get_settings
from app.core.personas import persona_briefs
from app.core.tools import TOOL_REGISTRY

router = APIRouter()


@router.get("/health")
async def health_check():
    settings = get_settings()
    return {
        "status": "ok",
        "env": settings.app_env,
        "llm_ready": settings.llm_ready,
        "model": settings.deepseek_model,
        "tools": sorted(TOOL_REGISTRY.keys()),
        "personas": [p["id"] for p in persona_briefs()],
    }
