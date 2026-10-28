"""AI 背景生成：Pollinations 在线生成 + 本地程序化兜底 + LRU 缓存。"""

import base64
import hashlib
import logging
import random
import urllib.parse
from collections import OrderedDict

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://image.pollinations.ai/prompt"

# 风格预设：前端展示文案 + 追加到 prompt 的英文关键词
STYLE_PRESETS: dict[str, dict] = {
    "anime": {"label": "动漫插画", "suffix": "anime scenery, makoto shinkai style, vibrant colors, detailed background art"},
    "ghibli": {"label": "吉卜力", "suffix": "studio ghibli background, hand painted, soft warm light, lush greenery"},
    "sakura": {"label": "樱花季", "suffix": "cherry blossom, pink petals, spring, romantic anime landscape"},
    "starry": {"label": "星夜", "suffix": "starry night sky, milky way, dreamy, purple blue gradient, anime illustration"},
    "cyber": {"label": "赛博霓虹", "suffix": "cyberpunk neon city, rainy street, glowing signs, futuristic anime background"},
    "watercolor": {"label": "水彩", "suffix": "watercolor painting, soft pastel, paper texture, gentle gradient"},
    "sunset": {"label": "黄昏", "suffix": "golden hour sunset, warm orange sky, sea horizon, anime clouds"},
}


class ImageGenerator:
    def __init__(self, cache_size: int | None = None):
        settings = get_settings()
        self.cache_size = cache_size or settings.image_cache_size
        self.timeout = settings.image_timeout
        self._cache: OrderedDict[str, str] = OrderedDict()

    # ------------------------------------------------------------------ #
    # 对外入口
    # ------------------------------------------------------------------ #
    async def generate(
        self,
        prompt: str,
        style: str = "anime",
        width: int = 1280,
        height: int = 800,
        seed: int | None = None,
    ) -> tuple[str, bool, bool]:
        """返回 (data_uri, 是否命中缓存, 是否兜底)。"""
        prompt = (prompt or "").strip()
        style_key = style if style in STYLE_PRESETS else "anime"
        seed = seed if seed is not None else self._stable_seed(prompt)
        key = f"{style_key}|{seed}|{width}x{height}|{prompt}"

        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key], True, False

        url = self._build_url(prompt, style_key, width, height, seed)
        for attempt in range(2):
            try:
                logger.info("Generating background (%s) attempt %s: %s", style_key, attempt + 1, prompt)
                data_uri = await self._fetch_as_data_uri(url, timeout=self.timeout)
                self._remember(key, data_uri)
                return data_uri, False, False
            except Exception as exc:  # noqa: BLE001
                logger.warning("Pollinations attempt %s failed: %s", attempt + 1, exc)

        logger.info("Falling back to procedural background for: %s", prompt)
        fallback = self._procedural_scene(prompt, style_key, width, height, seed)
        self._remember(key, fallback)
        return fallback, False, True

    # ------------------------------------------------------------------ #
    # 内部实现
    # ------------------------------------------------------------------ #
    def _build_url(self, prompt: str, style: str, width: int, height: int, seed: int) -> str:
        suffix = STYLE_PRESETS[style]["suffix"]
        enhanced = f"{prompt}, {suffix}, wide shot, no text, no watermark"
        encoded = urllib.parse.quote(enhanced, safe="")
        return (
            f"{BASE_URL}/{encoded}"
            f"?width={width}&height={height}&seed={seed}"
            f"&model=flux&safe=true&nologo=true"
        )

    async def _fetch_as_data_uri(self, url: str, timeout: float) -> str:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                raise ValueError(f"unexpected content-type: {content_type}")
            if len(resp.content) < 1024:
                raise ValueError("image payload too small")
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return f"data:{content_type};base64,{b64}"

    def _remember(self, key: str, value: str) -> None:
        self._cache[key] = value
        self._cache.move_to_end(key)
        while len(self._cache) > self.cache_size:
            self._cache.popitem(last=False)

    @staticmethod
    def _stable_seed(text: str) -> int:
        return int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16) % 99991

    # ------------------------------------------------------------------ #
    # 兜底：程序化生成一个好看的动漫风渐变场景
    # ------------------------------------------------------------------ #
    STYLE_HUES = {
        "anime": (280, 320),
        "ghibli": (90, 150),
        "sakura": (330, 360),
        "starry": (230, 270),
        "cyber": (280, 330),
        "watercolor": (200, 240),
        "sunset": (10, 45),
    }

    def _procedural_scene(self, prompt: str, style: str, width: int, height: int, seed: int) -> str:
        rng = random.Random(seed)
        hue_range = self.STYLE_HUES.get(style, (280, 320))
        h1 = rng.randint(*hue_range)
        h2 = (h1 + rng.randint(25, 70)) % 360

        def hsl(h: int, s: int, l: int) -> str:
            return f"hsl({h} {s}% {l}%)"

        parts = [
            f"<defs>",
            f"<linearGradient id='g' x1='0' y1='0' x2='0.4' y2='1'>",
            f"<stop offset='0%' stop-color='{hsl(h1, 70, 22)}'/>",
            f"<stop offset='55%' stop-color='{hsl((h1 + h2) // 2, 65, 38)}'/>",
            f"<stop offset='100%' stop-color='{hsl(h2, 70, 62)}'/>",
            f"</linearGradient>",
            f"<radialGradient id='glow' cx='50%' cy='35%' r='60%'>",
            f"<stop offset='0%' stop-color='{hsl(h2, 90, 70)}' stop-opacity='0.55'/>",
            f"<stop offset='100%' stop-color='{hsl(h2, 90, 70)}' stop-opacity='0'/>",
            f"</radialGradient>",
            f"</defs>",
            f"<rect width='{width}' height='{height}' fill='url(#g)'/>",
            f"<rect width='{width}' height='{height}' fill='url(#glow)'/>",
        ]

        # 光斑 / 星点
        for _ in range(28):
            cx = rng.randint(0, width)
            cy = rng.randint(0, height)
            r = rng.randint(3, int(height * 0.045))
            light = rng.randint(65, 92)
            parts.append(
                f"<circle cx='{cx}' cy='{cy}' r='{r}' fill='{hsl(h2, 85, light)}' "
                f"opacity='{rng.uniform(0.08, 0.35):.2f}'/>"
            )

        # 花瓣 / 飘浮物
        for _ in range(18):
            cx = rng.randint(0, width)
            cy = rng.randint(0, height)
            size = rng.randint(6, 16)
            rot = rng.randint(0, 180)
            parts.append(
                f"<ellipse cx='{cx}' cy='{cy}' rx='{size}' ry='{size * 0.55}' "
                f"fill='{hsl(h1, 80, 82)}' opacity='{rng.uniform(0.15, 0.45):.2f}' "
                f"transform='rotate({rot} {cx} {cy})'/>"
            )

        # 远景山影，增加层次
        for idx, base in enumerate((0.78, 0.9)):
            y = int(height * base)
            amp = int(height * (0.08 + 0.05 * idx))
            mid = int(width / 2)
            parts.append(
                f"<path d='M0 {height} L0 {y} Q {mid // 2} {y - amp} {mid} {y - amp // 3} "
                f"Q {mid + mid // 2} {y + amp // 2} {width} {y - amp // 2} L{width} {height} Z' "
                f"fill='{hsl(h1, 55, 14 + idx * 4)}' opacity='0.75'/>"
            )

        svg = (
            f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' "
            f"viewBox='0 0 {width} {height}'>{''.join(parts)}</svg>"
        )
        return "data:image/svg+xml;charset=utf-8," + urllib.parse.quote(svg, safe="")


image_generator = ImageGenerator()
