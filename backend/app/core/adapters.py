"""LLM 适配层：兼容 OpenAI 协议的流式调用（默认 DeepSeek）。"""

import logging
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class LLMNotConfiguredError(RuntimeError):
    """未配置 API Key。"""


class DeepSeekAdapter:
    """异步、流式、兼容 OpenAI 格式的 LLM 调用封装。"""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.model = self.settings.deepseek_model
        self.client: AsyncOpenAI | None = None
        if self.settings.llm_ready:
            self.client = AsyncOpenAI(
                api_key=self.settings.deepseek_api_key,
                base_url=self.settings.deepseek_base_url,
                timeout=self.settings.request_timeout,
                max_retries=1,
            )

    @property
    def ready(self) -> bool:
        return self.client is not None

    async def stream_completion(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AsyncIterator[Any]:
        """返回一个可异步迭代的 chunk 流（OpenAI SDK 的 AsyncStream）。

        调用方负责解析 choices[0].delta（含 content 与 tool_calls）。
        """
        if not self.client:
            raise LLMNotConfiguredError("DEEPSEEK_API_KEY 未配置")

        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.settings.temperature,
            "max_tokens": max_tokens or self.settings.max_tokens,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        stream = await self.client.chat.completions.create(**kwargs)
        return stream  # type: ignore[return-value]
