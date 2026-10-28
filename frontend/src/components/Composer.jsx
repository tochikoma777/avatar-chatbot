import { useEffect, useRef } from 'react';

import { IconMic, IconSend, IconStop } from './Icons';

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  listening,
  interim,
  micSupported,
  onToggleMic,
  placeholder,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (isStreaming) return;
      onSend?.();
    }
  };

  return (
    <div className="composer">
      {interim ? <div className="composer-interim">🎙️ {interim}</div> : null}

      <div className={`composer-box ${listening ? 'listening' : ''}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={listening}
        />

        {micSupported ? (
          <button
            type="button"
            className={`icon-btn mic ${listening ? 'active' : ''}`}
            onClick={onToggleMic}
            disabled={isStreaming}
            title={listening ? '停止录音' : '语音输入'}
          >
            <IconMic width={18} height={18} />
          </button>
        ) : null}

        {isStreaming ? (
          <button type="button" className="send-btn stop" onClick={onStop} title="停止生成">
            <IconStop width={16} height={16} />
            <span>停止</span>
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim()}
            title="发送"
          >
            <IconSend width={16} height={16} />
            <span>发送</span>
          </button>
        )}
      </div>

      <div className="composer-hint">
        <span>Enter 发送 · Shift + Enter 换行</span>
        {value.length > 200 ? <span className="counter">{value.length}</span> : null}
      </div>
    </div>
  );
}
