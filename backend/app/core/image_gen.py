import urllib.parse

class ImageGenerator:
    BASE_URL = "https://picsum.photos/seed"

    def generate_url(self, prompt: str, width: int = 512, height: int = 512) -> str:
        # 使用 prompt 作为种子，保证相同关键词每次返回同一张图
        encoded = urllib.parse.quote(prompt)
        return f"{self.BASE_URL}/{encoded}/{width}/{height}"