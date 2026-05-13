# backend/app/core/services.py
import json
import logging
from typing import AsyncGenerator
from app.core.adapters import DeepSeekAdapter
from app.core.tools import TOOLS, execute_tool

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        self.adapter = DeepSeekAdapter()

    async def stream_chat(
        self, 
        user_message: str, 
        system_prompt: str = None
    ) -> AsyncGenerator[str, None]:
        # 初始化消息
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_message})

        MAX_TOOL_CALLS = 3

        for _ in range(MAX_TOOL_CALLS):
            try:
                # 请求 DeepSeek（非流式，为了完整处理工具调用）
                response = await self.adapter.chat_non_stream(messages, TOOLS)
            except Exception as e:
                logger.error(f"DeepSeek API error: {e}")
                yield f"data: {json.dumps({'error': '服务暂时不可用，请稍后再试。'})}\n\n"
                yield f"data: {json.dumps({'finish_reason': 'error'})}\n\n"
                return

            # 安全地获取 tool_calls（可能为 None 或列表）
            tool_calls = getattr(response, 'tool_calls', None) or []

            if tool_calls:
                tool_call = tool_calls[0]
                tool_name = tool_call.function.name
                print(f"🔧 Tool call detected: {tool_name}")
                tool_args = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}

                # 通知前端正在调用工具
                yield f"data: {json.dumps({'status': 'tool_calling', 'tool': tool_name, 'message': f'🔧 正在使用工具：{tool_name}...'})}\n\n"

                try:
                    tool_result = execute_tool(tool_name)
                except Exception as e:
                    tool_result = f"工具执行失败: {str(e)}"

                # 将工具调用和结果追加到消息历史
                messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_name,
                            "arguments": json.dumps(tool_args, ensure_ascii=False)
                        }
                    }]
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result
                })
                # 继续循环，让模型根据工具结果生成最终回复
                continue
            else:
                # 没有工具调用，直接输出文本回复（模拟流式）
                content = response.content or ""
                for char in content:
                    yield f"data: {json.dumps({'content': char})}\n\n"
                break   # 跳出循环

        # 发送结束标记
        yield f"data: {json.dumps({'finish_reason': 'stop'})}\n\n"