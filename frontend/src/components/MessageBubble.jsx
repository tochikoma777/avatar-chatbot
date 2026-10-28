import { useState } from 'react';

import Markdown from './Markdown';
import { IconCheck, IconCopy, IconRefresh, IconTrash, IconVolume } from './Icons';

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageBubble({
  message,
  persona,
  showTime,
  animated,
  onRegenerate,
  onRemove,
  onSpeak,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };

  if (message.role === 'tool') {
    return (
      <div className={`tool-note ${message.done ? 'done' : 'pending'}`}>
        <span className="tool-badge">{message.done ? <IconCheck width={13} height={13} /> : <span className="tool-spinner" />}</span>
        <span className="tool-label">{message.label}</span>
        <span className="tool-text">{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const streaming = Boolean(message.streaming);

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-bot'} ${animated ? 'msg-animated' : ''}`}>
      <div className={`msg-avatar ${isUser ? 'avatar-user' : 'avatar-bot'}`}>
        <span>{isUser ? '😎' : persona.emoji}</span>
        {!isUser && streaming ? <i className="avatar-ping" /> : null}
      </div>

      <div className="msg-main">
        <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-bot'} ${message.error ? 'bubble-error' : ''}`}>
          {isUser ? (
            <p className="plain-text">{message.content}</p>
          ) : (
            <>
              {message.content ? <Markdown text={message.content} /> : null}
              {streaming && !message.content ? (
                <span className="typing"><i /><i /><i /></span>
              ) : null}
              {streaming && message.content ? <span className="caret" /> : null}
              {message.error ? <p className="msg-error">⚠️ {message.error}</p> : null}
              {message.stopped ? <p className="msg-stopped">（已停止生成）</p> : null}
            </>
          )}
        </div>

        <div className="msg-footer">
          {showTime ? <span className="msg-time">{formatTime(message.ts)}</span> : null}
          <div className="msg-actions">
            <button type="button" onClick={handleCopy} title="复制">
              {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
            </button>
            {!isUser ? (
              <>
                <button type="button" onClick={() => onSpeak?.(message.content)} title="朗读">
                  <IconVolume width={14} height={14} />
                </button>
                <button type="button" onClick={() => onRegenerate?.(message.id)} title="重新生成">
                  <IconRefresh width={14} height={14} />
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => onRemove?.(message.id)} title="删除">
              <IconTrash width={14} height={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
