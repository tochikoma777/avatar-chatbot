import json
from openai import AsyncOpenAI
from app.config import settings
from typing import AsyncGenerator

class DeepSeekAdapter:
    '''
    一个异步、流式、兼容 OpenAI 格式、自动读取配置的 DeepSeek 调用封装类.
    
    主要功能：
    用异步 HTTP 客户端调用 DeepSeek，流式接收返回，按 SSE 格式逐块吐出，前端就能看到打字机一样的实时输出，全程不阻塞、高性能、高并发。
    '''
    def __init__(self):
        # 初始化异步OpenAI客户端，指向DeepSeek
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url
        )
        self.model = "deepseek-chat"   # DeepSeek 的聊天模型

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> AsyncGenerator[str, None]:
        """
        流式对话生成器，逐个返回数据块（符合Server-Sent Events格式）
        """
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    # 将内容封装为JSON并加上SSE的"data:"前缀
                    yield f"data: {json.dumps({'content': chunk.choices[0].delta.content},ensure_ascii=False)}\n\n"
                if chunk.choices[0].finish_reason:
                    yield f"data: {json.dumps({'finish_reason': chunk.choices[0].finish_reason})}\n\n"
                    break
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            raise

    # 新增：非流式聊天，支持工具调用
    async def chat_non_stream(self, messages: list, tools: list = None):
        """非流式请求，用于处理工具调用场景"""
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=tools,
            temperature=0.7,
            max_tokens=1024,
            stream=False  # 关键
        )
        return response.choices[0].message
        # message 对象包含 .content 和 .tool_calls 属性