// frontend/src/components/ChatBox.jsx
import React, { useState, useRef, useEffect } from 'react';
import { sendMessageStream } from '../services/chatApi';

// 检查浏览器是否支持语音识别
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;
let recognition = null;
if (isSpeechRecognitionSupported) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
}

export default function ChatBox({ onSpeakingChange }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);
  const messagesEndRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 朗读文本的函数
  const speakText = (text) => {
    if (!synthRef.current) return;
    // 停止之前的朗读
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    utterance.onstart = () => {
      setIsSpeakingTTS(true);
      onSpeakingChange(true);
    };
    utterance.onend = () => {
      setIsSpeakingTTS(false);
      onSpeakingChange(false);
    };
    utterance.onerror = () => {
      setIsSpeakingTTS(false);
      onSpeakingChange(false);
    };
    synthRef.current.speak(utterance);
  };

  // 自动朗读最新的助手消息
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content && !isWaiting) {
      // 朗读内容，但避免重复朗读同一条消息（通过比较内容长度简单判断）
      speakText(lastMsg.content);
    }
  }, [messages, isWaiting]);

  // 语音识别开始
  const startListening = () => {
    if (!recognition || isListening) return;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognition) recognition.stop();
    setIsListening(false);
  };

  // 绑定语音识别事件
  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isWaiting) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsWaiting(true);
    onSpeakingChange(true);

    const reader = await sendMessageStream(input, "你是一个温柔、可爱的二次元美少女。");

    let botMessage = { role: 'assistant', content: '' };
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.status === 'tool_calling') {
                setMessages(prev => [...prev, { role: 'system', content: json.message }]);
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
                // 流结束
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error);
      setMessages(prev => [...prev, { role: 'system', content: '网络请求失败，请稍后重试。' }]);
    } finally {
      setIsWaiting(false);
      onSpeakingChange(false);
    }
  };

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
            <div className="avatar">
              {msg.role === 'user' ? '😎' : msg.role === 'system' ? '🔧' : '🌸'}
            </div>
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
          placeholder={isListening ? '正在聆听...' : '输入你想说的话，或点击麦克风说话'}
          rows={2}
          disabled={isWaiting || isListening}
        />
        {isSpeechRecognitionSupported && (
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isWaiting}
            className={`mic-btn ${isListening ? 'active' : ''}`}
            title={isListening ? '停止录音' : '语音输入'}
          >
            🎤
          </button>
        )}
        <button onClick={handleSend} disabled={isWaiting || !input.trim()}>
          发送
        </button>
        {isSpeakingTTS && <span className="speaking-indicator">🔊 播放中</span>}
      </div>
    </div>
  );
}