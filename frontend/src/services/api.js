// 后端 API 封装：SSE 流式对话 / AI 背景生成 / 健康检查
const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = `请求失败（${res.status}）`;
    try {
      const data = await res.json();
      detail = data.detail || data.message || detail;
    } catch {
      /* 非 JSON 响应，使用默认文案 */
    }
    throw new Error(detail);
  }
  return res.json();
}

/**
 * 流式对话。payload: { message, personaId, systemPrompt, history, enableTools }
 * onEvent(data) 收到后端推送的 JSON 事件。
 */
export async function streamChat(payload, { signal, onEvent } = {}) {
  const res = await fetch(`${API_BASE}/chat/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: payload.message,
      persona_id: payload.personaId,
      system_prompt: payload.systemPrompt || undefined,
      history: payload.history || [],
      enable_tools: payload.enableTools !== false,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `对话请求失败（${res.status}）`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const handle = (raw) => {
    const line = raw.trim();
    if (!line.startsWith('data:')) return;
    try {
      onEvent?.(JSON.parse(line.slice(5).trim()));
    } catch {
      /* 忽略半包或脏数据 */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      handle(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
  }
  if (buffer.trim()) handle(buffer);
}

export function generateImage({ prompt, style = 'anime', width = 1280, height = 800 }) {
  return requestJson('/generate/generate-image', {
    method: 'POST',
    body: JSON.stringify({ prompt, style, width, height }),
  });
}

export function fetchHealth() {
  return requestJson('/health/health');
}

export function fetchPersonas() {
  return requestJson('/personas/personas');
}
