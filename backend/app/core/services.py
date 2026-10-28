"""对话业务：真实流式输出 + 多轮上下文 + 工具调用 + 情绪事件。"""

import json
import logging
import random
import re
from typing import AsyncGenerator

from app.config import get_settings
from app.core.adapters import LLMNotConfiguredError, DeepSeekAdapter
from app.core.models import ChatRequest
from app.core.personas import get_persona
from app.core.tools import TOOLS, TOOL_LABELS, execute_tool

logger = logging.getLogger(__name__)

EMOTIONS = {"happy", "shy", "sad", "angry", "surprise", "calm"}
EMOTION_RE = re.compile(r"^\s*[\[［]\s*(?:emotion|情绪)\s*[:：]\s*([a-zA-Z一-龥]+)\s*[\]］]\s*")
# 等待标签出现时最多缓冲的字符数，超过则原样输出
EMOTION_BUFFER_LIMIT = 48


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


class EmotionBuffer:
    """在流的最前面截获 [emotion:xxx] 标签，其余内容原样透传。"""

    def __init__(self):
        self.pending = ""
        self.resolved = False

    def feed(self, chunk: str) -> tuple[str, str | None]:
        if self.resolved:
            return chunk, None

        self.pending += chunk
        match = EMOTION_RE.match(self.pending)
        if match:
            self.resolved = True
            emotion = match.group(1).strip().lower()
            alias = {"开心": "happy", "害羞": "shy", "难过": "sad", "生气": "angry",
                     "惊讶": "surprise", "平静": "calm"}
            emotion = alias.get(emotion, emotion)
            rest = self.pending[match.end():]
            self.pending = ""
            if emotion not in EMOTIONS:
                return rest, None
            return rest, emotion

        # 还没凑齐标签：只可能是以 '[' 开头的短前缀，否则直接放行
        if len(self.pending) >= EMOTION_BUFFER_LIMIT or not self.pending.lstrip().startswith(("[", "［")):
            out, self.pending = self.pending, ""
            return out, None
        return "", None

    def flush(self) -> str:
        out, self.pending = self.pending, ""
        return out


def build_messages(request: ChatRequest) -> list[dict]:
    """系统提示 + 历史（截断）+ 当前用户输入。"""
    settings = get_settings()
    persona = get_persona(request.persona_id)

    system_prompt = (request.system_prompt or "").strip() or persona.system_prompt
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    history = [m for m in request.history if m.content and m.content.strip()]
    max_messages = settings.max_history_turns * 2
    for item in history[-max_messages:]:
        messages.append({"role": item.role, "content": item.content})

    messages.append({"role": "user", "content": request.message})
    return messages


class ChatService:
    def __init__(self):
        self.settings = get_settings()
        self.adapter = DeepSeekAdapter(self.settings)

    # ------------------------------------------------------------------ #
    # 主入口
    # ------------------------------------------------------------------ #
    async def stream_chat(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        messages = build_messages(request)

        if not self.adapter.ready:
            async for chunk in self._offline_stream(request):
                yield chunk
            return

        yield sse({"status": "ready", "persona": request.persona_id})

        max_turns = max(1, self.settings.max_tool_turns)
        use_tools = request.enable_tools

        for turn in range(max_turns):
            is_last = turn == max_turns - 1
            tools = (TOOLS if use_tools else None) if not is_last else None

            pending_events: list[str] = []
            try:
                tool_calls = await self._stream_turn(messages, tools, pending_events)
            except LLMNotConfiguredError:
                yield sse({"error": "还没有配置 DEEPSEEK_API_KEY，当前处于离线陪聊模式。"})
                break
            except Exception as exc:  # noqa: BLE001
                logger.exception("LLM stream failed")
                for event in pending_events:
                    yield event
                yield sse({"error": f"模型服务开小差了：{exc}"})
                yield sse({"finish_reason": "error"})
                return

            for event in pending_events:
                yield event

            if not tool_calls:
                break

            # 先把「模型的工具调用」写回上下文，再逐个执行并回写结果
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": call["id"],
                        "type": "function",
                        "function": {"name": call["name"], "arguments": call["arguments"] or "{}"},
                    }
                    for call in tool_calls
                ],
            })
            for call in tool_calls:
                label = TOOL_LABELS.get(call["name"], call["name"])
                yield sse({
                    "status": "tool_calling",
                    "tool": call["name"],
                    "label": label,
                    "message": f"正在使用「{label}」…",
                })
                result = await execute_tool(call["name"], call["arguments"])
                yield sse({"status": "tool_result", "tool": call["name"], "label": label, "message": result})
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": result})

            if is_last:
                yield sse({"error": "工具调用轮次用完了，先聊点别的吧～"})
                break

        yield sse({"finish_reason": "stop"})

    # ------------------------------------------------------------------ #
    # 单轮流式
    # ------------------------------------------------------------------ #
    async def _stream_turn(
        self,
        messages: list[dict],
        tools: list[dict] | None,
        out: list[str],
    ) -> list[dict]:
        """流式输出本轮文本（事件写入 out），返回需要执行的工具调用（可能为空）。"""
        stream = await self.adapter.stream_completion(messages, tools=tools)
        buffer = EmotionBuffer()
        tool_calls: dict[int, dict] = {}

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta

            if getattr(delta, "content", None):
                text, emotion = buffer.feed(delta.content)
                if emotion:
                    out.append(sse({"emotion": emotion}))
                if text:
                    out.append(sse({"content": text}))

            for tc_delta in getattr(delta, "tool_calls", None) or []:
                index = getattr(tc_delta, "index", 0) or 0
                entry = tool_calls.setdefault(index, {"id": "", "name": "", "arguments": ""})
                if getattr(tc_delta, "id", None):
                    entry["id"] += tc_delta.id
                fn = getattr(tc_delta, "function", None)
                if fn is not None:
                    if getattr(fn, "name", None):
                        entry["name"] += fn.name
                    if getattr(fn, "arguments", None):
                        entry["arguments"] += fn.arguments

            if getattr(chunk.choices[0], "finish_reason", None):
                break

        tail = buffer.flush()
        if tail:
            out.append(sse({"content": tail}))

        result = []
        for index in sorted(tool_calls):
            entry = tool_calls[index]
            if not entry["name"]:
                continue
            entry["id"] = entry["id"] or f"call_{index}"
            result.append(entry)
        return result  # type: ignore[return-value]

    # ------------------------------------------------------------------ #
    # 离线陪聊（未配置 Key 时的降级体验）
    # ------------------------------------------------------------------ #
    async def _offline_stream(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        yield sse({"status": "ready", "persona": request.persona_id, "offline": True})
        yield sse({"emotion": "shy"})

        text = random.choice([
            "（离线模式）后端还没有配置 DEEPSEEK_API_KEY，我现在只能靠预置台词陪你啦～"
            "在 backend/.env 里填上密钥，重启后端就能和我真正聊天了 (｡･ω･｡)",
            "（离线模式）呜呜，我的大脑还没连上线……先在 backend/.env 里配置好 API Key 吧，"
            "那样我就能回答你所有的问题了！",
        ])
        for i in range(0, len(text), 6):
            yield sse({"content": text[i:i + 6]})
        yield sse({"finish_reason": "stop"})
