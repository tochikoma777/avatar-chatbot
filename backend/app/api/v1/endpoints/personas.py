from fastapi import APIRouter

from app.core.personas import persona_briefs

router = APIRouter()


@router.get("/personas")
async def list_personas():
    """返回内置角色简介（用于前端展示与问候语）。"""
    return {"personas": persona_briefs()}
