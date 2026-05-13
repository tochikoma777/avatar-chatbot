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
    image_url: str

@router.post("/generate-image", response_model=ImageResponse)
async def generate_image(request: ImageRequest):
    """
    根据描述生成背景图片
    """
    # 生成图片 URL
    url = image_gen.generate_url(request.prompt, request.width, request.height)
    return ImageResponse(image_url=url)