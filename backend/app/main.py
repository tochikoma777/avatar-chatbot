import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import router as v1_router
from app.config import get_settings

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.app_env == "development" else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("avatar-chatbot")

app = FastAPI(
    title="Avatar Chatbot API",
    version="1.0.0",
    description="二次元看板娘聊天机器人后端：真实流式对话、多轮上下文、Agent 工具调用与 AI 背景生成。",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "Avatar Chatbot API started | env=%s | llm_ready=%s | model=%s",
        settings.app_env,
        settings.llm_ready,
        settings.deepseek_model,
    )
    if not settings.llm_ready:
        logger.warning("未检测到 DEEPSEEK_API_KEY，对话将进入离线陪聊模式。")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # pragma: no cover
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "服务器内部错误，请稍后再试～"})


@app.get("/")
async def root():
    return {
        "message": "Welcome to Avatar Chatbot API ✿",
        "docs": "/docs",
        "health": "/api/v1/health/health",
        "llm_ready": settings.llm_ready,
    }
