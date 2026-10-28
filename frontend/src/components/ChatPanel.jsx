import { useEffect, useRef } from 'react';

import { PERSONAS } from '../config/personas';
import Composer from './Composer';
import MessageBubble from './MessageBubble';
import { IconDownload, IconSettings, IconTrash } from './Icons';

export default function ChatPanel({
  persona,
  onPersonaChange,
  messages,
  isStreaming,
  settings,
  input,
  onInputChange,
  onSend,
  onStop,
  onRegenerate,
  onRemove,
  onSpeak,
  onClear,
  onExport,
  onOpenSettings,
  speech,
}) {
  const listRef = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !stickRef.current) return;
    if (isStreaming || typeof el.scrollTo !== 'function') {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  const isEmpty = messages.length === 0;

  return (
    <section className="chat" aria-label="聊天面板">
      <header className="chat-header">
        <div className="chat-title">
          <span className="chat-title-avatar" style={{ '--persona-accent': persona.accent }}>
            {persona.emoji}
          </span>
          <div>
            <strong>{persona.name}</strong>
            <span className={`chat-status ${isStreaming ? 'busy' : ''}`}>
              {isStreaming ? '正在思考…' : '在线'}
            </span>
          </div>
        </div>
        <div className="chat-header-actions">
          <button type="button" className="icon-btn" onClick={onExport} title="导出对话">
            <IconDownload width={17} height={17} />
          </button>
          <button type="button" className="icon-btn" onClick={onClear} title="清空对话">
            <IconTrash width={17} height={17} />
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} title="设置">
            <IconSettings width={17} height={17} />
          </button>
        </div>
      </header>

      <div className="persona-strip" role="tablist" aria-label="切换角色">
        {PERSONAS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={item.id === persona.id}
            type="button"
            className={`persona-chip ${item.id === persona.id ? 'active' : ''}`}
            onClick={() => onPersonaChange?.(item.id)}
            title={item.tagline}
          >
            <span className="persona-chip-emoji" style={{ '--persona-accent': item.accent }}>
              {item.emoji}
            </span>
            <span className="persona-chip-name">{item.name}</span>
          </button>
        ))}
      </div>

      <div className="msg-list" ref={listRef} onScroll={handleScroll}>
        {isEmpty ? (
          <div className="empty-state">
            <div className="empty-avatar" style={{ '--persona-accent': persona.accent }}>
              <span>{persona.emoji}</span>
            </div>
            <h2>{persona.name}</h2>
            <p className="empty-tagline">{persona.tagline}</p>
            <p className="empty-greeting">{persona.greeting}</p>
            <div className="suggestions">
              {persona.suggestions.map((tip) => (
                <button key={tip} type="button" className="suggestion" onClick={() => onSend?.(tip)}>
                  {tip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              persona={persona}
              showTime={settings.showTimestamps}
              animated={settings.bubbleAnimation}
              onRegenerate={onRegenerate}
              onRemove={onRemove}
              onSpeak={onSpeak}
            />
          ))
        )}
      </div>

      <Composer
        value={input}
        onChange={onInputChange}
        onSend={() => onSend?.(input)}
        onStop={onStop}
        isStreaming={isStreaming}
        listening={speech.listening}
        interim={speech.interim}
        micSupported={speech.supported && settings.asrEnabled}
        onToggleMic={() => (speech.listening ? speech.stop() : speech.start())}
        placeholder={speech.listening ? '正在聆听…' : `和 ${persona.name} 说点什么吧～`}
      />
    </section>
  );
}
