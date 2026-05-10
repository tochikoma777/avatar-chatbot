from typing import AsyncGenerator
from app.core.adapters import DeepSeekAdapter

class ChatService:
    def __init__(self):
        self.adapter = DeepSeekAdapter()

    async def stream_chat(
        self, 
        user_message: str, 
        system_prompt: str = None
    ) -> AsyncGenerator[str, None]:
        """处理用户消息，返回流式响应"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_message})
        
        async for chunk in self.adapter.chat_stream(messages):
            yield chunk