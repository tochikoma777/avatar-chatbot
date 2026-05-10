from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import router as v1_router

app = FastAPI(
    title="Avatar Chatbot API",
    version="0.1.0",
    description="可视化聊天机器人后端API"
)

# 允许前端跨域访问（后续会在本地运行前端）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(v1_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to Avatar Chatbot API"}