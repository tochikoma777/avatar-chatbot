# backend/app/api/v1/endpoints/generate.py
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.image_gen import ImageGenerator

router = APIRouter()
image_gen = ImageGenerator()

class ImageRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512

class ImageResponse(BaseModel):
    image_data: str   # 改为 base64 data URI

@router.post("/generate-image", response_model=ImageResponse)
async def generate_image(request: ImageRequest):
    """
    根据描述生成背景图片，返回 base64 格式
    """
    try:
        img_data = await image_gen.generate_image_base64(
            request.prompt, request.width, request.height
        )
        return ImageResponse(image_data=img_data)
    except Exception as e:
        # 生成失败时返回一个红色占位图，方便调试
        return ImageResponse(image_data="")