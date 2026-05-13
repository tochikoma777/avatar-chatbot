# backend/app/core/image_gen.py
import httpx
import base64
import urllib.parse
import logging
import hashlib

logger = logging.getLogger(__name__)

class ImageGenerator:
    BASE_URL = "https://image.pollinations.ai/prompt"
    FALLBACK_BASE = "https://picsum.photos/seed"

    async def _fetch_image_as_base64(self, url: str, timeout: float = 20.0) -> str:
        """通用方法：下载图片并转为 base64 data URI"""
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            image_bytes = response.content
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"

    async def generate_image_base64(self, prompt: str, width: int = 512, height: int = 512) -> str:
        # 1. 尝试用 Pollinations AI 生成
        encoded_prompt = urllib.parse.quote(prompt)
        ai_url = f"{self.BASE_URL}/{encoded_prompt}?width={width}&height={height}&nologo=true"

        for attempt in range(2):  # 最多尝试两次
            try:
                logger.info(f"Attempt {attempt+1} generating image for: {prompt}")
                return await self._fetch_image_as_base64(ai_url, timeout=25.0)
            except Exception as e:
                logger.warning(f"Attempt {attempt+1} failed: {e}")

        # 2. 如果全部失败，使用 Picsum 兜底（固定种子，同一提示词返回同一张图）
        logger.info(f"AI generation failed, falling back to Picsum for prompt: {prompt}")
        seed = int(hashlib.md5(prompt.encode()).hexdigest(), 16) % 10000
        fallback_url = f"{self.FALLBACK_BASE}/{seed}/{width}/{height}"
        try:
            return await self._fetch_image_as_base64(fallback_url, timeout=10.0)
        except Exception as e:
            logger.error(f"Even fallback failed: {e}")
            # 返回一个纯色占位图（浅蓝色）
            return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='100%25' height='100%25' fill='%233b4252'/%3E%3C/svg%3E"