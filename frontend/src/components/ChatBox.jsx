// src/components/ChatBox.jsx
import React, { useState, useRef, useEffect } from 'react';
import { sendMessageStream } from '../services/chatApi';

export default function ChatBox({ onSpeakingChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const messagesEndRef = useRef(null);

  // 自动滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isWaiting) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsWaiting(true);
    onSpeakingChange(true);   // 通知父组件：开始说话

    // const reader = await sendMessageStream(input, "你是一个温柔、可爱的二次元美少女。");
    // 预设多个人设
    const personaList = [
    "你是一个温柔、可爱的二次元猫娘。",
    "你是软萌傲娇的二次元萝莉。",
    "你是高冷毒舌的二次元御姐。"
    ];

    // 选择第0个（猫娘）
    const persona = personaList[0];
    const reader = await sendMessageStream(input, persona);
    // 把默认人设固定在这里，也可以做成可调

    let botMessage = { role: 'assistant', content: '' };

    // 处理流式数据
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 格式：可能有多个 "data: {...}\n\n" 在同一个块中
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // 最后一个可能不完整

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
            if (json.status === 'tool_calling') {
                setMessages(prev => [
                    ...prev,
                    { role: 'system', content: json.message }
                ]);
            } else if (json.content) {
                botMessage.content += json.content;
                setMessages(prev => {
                    const updated = [...prev];
                    if (updated.length === 0 || updated[updated.length - 1].role !== 'assistant') {
                        updated.push({ ...botMessage });
                    } else {
                        updated[updated.length - 1].content = botMessage.content;
                    }
                    return updated;
                });
            } else if (json.finish_reason) {
                // 结束
            }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setMessages(prev => [...prev, { role: 'system', content: '网络请求失败，请稍后重试。' }]);
    } finally {
      setIsWaiting(false);
      onSpeakingChange(false); // 通知父组件：停止说话
    }
  };

  // 处理回车发送
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbox-container">
      <div className="messages-list">
        {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
            {/* 头像 */}
            <div className="avatar">
                {msg.role === 'user' ? '😎' : '🌸'}
            </div>
            {/* 气泡 */}
            <div className="bubble">{msg.content}</div>
            </div>
        ))}
        {isWaiting && (!messages.length || messages[messages.length - 1]?.role !== 'assistant') && (
            <div className="message assistant">
            <div className="avatar">🌸</div>
            <div className="bubble">思考中...</div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你想说的话..."
          rows={2}
          disabled={isWaiting}
        />
        <button onClick={handleSend} disabled={isWaiting || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}