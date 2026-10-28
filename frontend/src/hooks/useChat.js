import { useCallback, useMemo, useRef, useState } from 'react';

import { streamChat } from '../services/api';
import usePersistedState from './usePersistedState';

const MAX_HISTORY_TURNS = 12;

let seq = 0;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${(seq += 1)}`;

function toHistory(messages) {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .slice(-MAX_HISTORY_TURNS * 2)
    .map(({ role, content }) => ({ role, content }));
}

/**
 * 聊天状态机：消息列表（持久化）、流式接收、工具调用状态、停止 / 重新生成。
 */
export default function useChat({ personaId, settings, onReply, onError }) {
  const storageKey = `avatar-chat.history.${personaId}`;
  const [messages, setMessages] = usePersistedState(storageKey, []);
  const [status, setStatus] = useState('idle'); // idle | streaming
  const abortRef = useRef(null);
  const replyRef = useRef(onReply);
  const errorRef = useRef(onError);
  replyRef.current = onReply;
  errorRef.current = onError;

  const patchMessage = useCallback((id, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, [setMessages]);

  const runStream = useCallback(
    async (text, history) => {
      const assistantId = uid('a');
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', emotion: null, ts: Date.now(), streaming: true },
      ]);
      setStatus('streaming');

      const controller = new AbortController();
      abortRef.current = controller;
      let content = '';
      let emotion = null;

      try {
        await streamChat(
          {
            message: text,
            personaId,
            systemPrompt: settings.customPersona?.trim() || undefined,
            history,
            enableTools: settings.enableTools !== false,
          },
          {
            signal: controller.signal,
            onEvent: (data) => {
              if (data.content) {
                content += data.content;
                patchMessage(assistantId, { content });
              } else if (data.emotion) {
                emotion = data.emotion;
                patchMessage(assistantId, { emotion });
              } else if (data.status === 'tool_calling') {
                // 工具提示插在助理占位消息之前，保证「用户 → 工具 → 回复」的阅读顺序
                setMessages((prev) => {
                  const next = [...prev];
                  let insertAt = next.length;
                  for (let i = next.length - 1; i >= 0; i -= 1) {
                    if (next[i].role === 'assistant') {
                      insertAt = i;
                      break;
                    }
                  }
                  next.splice(insertAt, 0, {
                    id: uid('t'),
                    role: 'tool',
                    tool: data.tool,
                    label: data.label || '工具',
                    content: data.message || '',
                    done: false,
                    ts: Date.now(),
                  });
                  return next;
                });
              } else if (data.status === 'tool_result') {
                setMessages((prev) => {
                  const next = [...prev];
                  for (let i = next.length - 1; i >= 0; i -= 1) {
                    if (next[i].role === 'tool' && next[i].tool === data.tool && !next[i].done) {
                      next[i] = { ...next[i], content: data.message || '', done: true };
                      break;
                    }
                  }
                  return next;
                });
              } else if (data.error) {
                errorRef.current?.(data.error);
                content = content || '';
                patchMessage(assistantId, { error: data.error });
              }
            },
          },
        );
      } catch (err) {
        if (err?.name === 'AbortError') {
          patchMessage(assistantId, { content: content || '（已停止生成）', streaming: false, stopped: true });
        } else {
          errorRef.current?.(err.message || '网络请求失败，请检查后端服务是否已启动。');
          patchMessage(assistantId, {
            content: content || '',
            error: err.message || '网络请求失败',
            streaming: false,
          });
        }
      } finally {
        abortRef.current = null;
        setStatus('idle');
        patchMessage(assistantId, { streaming: false });
        if (content.trim()) replyRef.current?.(content, emotion);
      }
    },
    [patchMessage, personaId, setMessages, settings.customPersona, settings.enableTools],
  );

  const send = useCallback(
    (text) => {
      const value = (text || '').trim();
      if (!value || status === 'streaming') return;
      const history = toHistory(messages);
      setMessages((prev) => [...prev, { id: uid('u'), role: 'user', content: value, ts: Date.now() }]);
      runStream(value, history);
    },
    [messages, runStream, setMessages, status],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(
    (assistantId) => {
      if (status === 'streaming') return;
      const index = messages.findIndex((m) => m.id === assistantId);
      if (index === -1) return;
      let userIndex = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'user') {
          userIndex = i;
          break;
        }
      }
      if (userIndex === -1) return;
      const base = messages.slice(0, userIndex);
      const userMessage = messages[userIndex];
      setMessages([...base, userMessage]);
      runStream(userMessage.content, toHistory(base));
    },
    [messages, runStream, setMessages, status],
  );

  const removeMessage = useCallback(
    (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
    [setMessages],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, [setMessages]);

  const exportMarkdown = useCallback(() => {
    const lines = messages
      .filter((m) => m.role !== 'tool')
      .map((m) => {
        const who = m.role === 'user' ? '你' : '看板娘';
        const time = new Date(m.ts || Date.now()).toLocaleString('zh-CN');
        return `### ${who} · ${time}\n\n${m.content || ''}`;
      });
    return `# 对话记录\n\n${lines.join('\n\n')}\n`;
  }, [messages]);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );

  return {
    messages,
    status,
    isStreaming: status === 'streaming',
    send,
    stop,
    regenerate,
    removeMessage,
    clear,
    exportMarkdown,
    lastAssistant,
  };
}
