from fastapi import APIRouter, Depends

from app.api.dependencies import get_image_generator
from app.core.image_gen import STYLE_PRESETS, ImageGenerator
from app.core.models import ImageRequest, ImageResponse

router = APIRouter()


@router.get("/styles")
async def list_styles():
    return {
        "styles": [{"id": key, "label": value["label"]} for key, value in STYLE_PRESETS.items()]
    }


@router.post("/generate-image", response_model=ImageResponse)
async def generate_image(
    request: ImageRequest,
    generator: ImageGenerator = Depends(get_image_generator),
):
    """根据描述生成二次元风格背景，返回 data URI。"""
    image_data, cached, fallback = await generator.generate(
        prompt=request.prompt,
        style=request.style,
        width=request.width,
        height=request.height,
        seed=request.seed,
    )
    return ImageResponse(image_data=image_data, cached=cached, fallback=fallback)
