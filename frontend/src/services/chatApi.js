// src/services/chatApi.js

/**
 * 发送消息并返回一个 ReadableStream 读取器
 * @param {string} message 用户输入的消息
 * @param {string} systemPrompt 系统人设（可选）
 * @returns {ReadableStreamDefaultReader}
 */
export async function sendMessageStream(message, systemPrompt = null) {
  const response = await fetch('/api/v1/chat/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message,
      system_prompt: systemPrompt || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // 返回流阅读器
  return response.body.getReader();
}