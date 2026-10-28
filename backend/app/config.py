"""应用配置（环境变量驱动，缺失密钥时也能启动）。"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
]


class Settings(BaseSettings):
    """全局配置。所有字段都可以通过 .env / 环境变量覆盖。"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- LLM ----
    deepseek_api_key: str = Field("", alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field("https://api.deepseek.com", alias="DEEPSEEK_BASE_URL")
    deepseek_model: str = Field("deepseek-chat", alias="DEEPSEEK_MODEL")
    request_timeout: float = Field(60.0, alias="REQUEST_TIMEOUT")
    temperature: float = Field(0.85, alias="TEMPERATURE")
    max_tokens: int = Field(1024, alias="MAX_TOKENS")

    # ---- 会话 ----
    max_history_turns: int = Field(12, alias="MAX_HISTORY_TURNS")
    max_tool_turns: int = Field(3, alias="MAX_TOOL_TURNS")

    # ---- 服务 ----
    app_env: str = Field("development", alias="APP_ENV")
    cors_origins: list[str] = Field(default_factory=lambda: list(DEFAULT_CORS_ORIGINS), alias="CORS_ORIGINS")

    # ---- 图像生成 ----
    image_cache_size: int = Field(32, alias="IMAGE_CACHE_SIZE")
    image_timeout: float = Field(30.0, alias="IMAGE_TIMEOUT")

    @property
    def llm_ready(self) -> bool:
        return bool(self.deepseek_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
