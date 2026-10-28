import { useCallback, useEffect, useRef, useState } from 'react';

import ChatPanel from './components/ChatPanel';
import SettingsDrawer from './components/SettingsDrawer';
import Splash from './components/Splash';
import StagePanel from './components/StagePanel';
import { ToastProvider } from './components/Toast';
import { DEFAULT_PERSONA_ID, getPersona } from './config/personas';
import { DEFAULT_SETTINGS } from './config/settings';
import useChat from './hooks/useChat';
import usePersistedState from './hooks/usePersistedState';
import useSpeech from './hooks/useSpeech';
import useTTS from './hooks/useTTS';
import useToast from './hooks/useToast';
import { fetchHealth } from './services/api';
import './styles/index.css';

function Workspace() {
  const toast = useToast();
  const [settings, setSettings] = usePersistedState('avatar-chat.settings', DEFAULT_SETTINGS, { merge: true });
  const [personaId, setPersonaId] = usePersistedState('avatar-chat.persona', DEFAULT_PERSONA_ID);
  const persona = getPersona(personaId);

  const [input, setInput] = useState('');
  const [booting, setBooting] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emotion, setEmotion] = useState(null);
  const [view, setView] = useState('stage'); // 移动端视图切换
  const [backend, setBackend] = useState({ online: null, llmReady: null });
  const pulseRef = useRef(0);

  const patchSettings = useCallback(
    (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    [setSettings],
  );

  const tts = useTTS(settings, {
    onBoundary: () => {
      pulseRef.current = performance.now();
    },
  });

  const speech = useSpeech({
    lang: settings.asrLang,
    onFinal: (text) => setInput((prev) => (prev ? `${prev}${text}` : text)),
    onError: (error) => {
      if (error === 'not-allowed') toast('麦克风权限被拒绝，请到浏览器设置里允许哦', 'error');
      else if (error !== 'aborted') toast(`语音识别失败：${error}`, 'error');
    },
  });

  const handleReply = useCallback(
    (content, replyEmotion) => {
      if (replyEmotion) setEmotion(replyEmotion);
      if (settings.autoSpeak) tts.speak(content);
    },
    [settings.autoSpeak, tts],
  );

  const handleError = useCallback((message) => toast(message, 'error'), [toast]);

  const chat = useChat({ personaId, settings, onReply: handleReply, onError: handleError });

  // 首屏：模型就绪或超时后收起加载页
  const handleModelState = useCallback(() => setBooting(false), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  // 后端健康检查
  useEffect(() => {
    let alive = true;
    fetchHealth()
      .then((data) => {
        if (!alive) return;
        setBackend({ online: true, llmReady: data.llm_ready });
        if (!data.llm_ready) {
          toast('后端未配置 DEEPSEEK_API_KEY，当前为离线陪聊模式', 'error');
        }
      })
      .catch(() => {
        if (!alive) return;
        setBackend({ online: false, llmReady: false });
        toast('连不上后端服务，请先在 backend 目录启动 uvicorn', 'error');
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  // 主题变量跟随角色 / 设置
  useEffect(() => {
    document.documentElement.dataset.accent = settings.themeAccent;
  }, [settings.themeAccent]);
  useEffect(() => {
    document.documentElement.style.setProperty('--persona-accent', persona.accent);
  }, [persona.accent]);

  const handleSend = useCallback(
    (text) => {
      const value = (typeof text === 'string' ? text : input).trim();
      if (!value || chat.isStreaming) return;
      setInput('');
      setView('chat');
      chat.send(value);
    },
    [chat, input],
  );

  const handleExport = useCallback(() => {
    const markdown = chat.exportMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${persona.name}-对话-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast('对话已导出为 Markdown', 'success');
  }, [chat, persona.name, toast]);

  const handleClear = useCallback(() => {
    chat.clear();
    toast('已清空当前角色的对话', 'success');
  }, [chat, toast]);

  const handlePersonaChange = useCallback(
    (id) => {
      tts.cancel();
      setPersonaId(id);
      setEmotion(null);
    },
    [setPersonaId, tts],
  );

  const speaking = tts.speaking || chat.isStreaming;

  return (
    <>
      <Splash visible={booting} />

      <div className={`app view-${view}`}>
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">✿</span>
            <span className="brand-text">Avatar Chatbot</span>
          </div>

          <div className="mobile-tabs">
            <button
              type="button"
              className={view === 'stage' ? 'active' : ''}
              onClick={() => setView('stage')}
            >
              看板娘
            </button>
            <button
              type="button"
              className={view === 'chat' ? 'active' : ''}
              onClick={() => setView('chat')}
            >
              聊天
            </button>
          </div>

          <div className="topbar-right">
            <span className={`status-pill ${backend.online === false ? 'offline' : backend.llmReady === false ? 'warn' : 'ok'}`}>
              {backend.online === false ? '后端离线' : backend.llmReady === false ? '离线陪聊' : '模型就绪'}
            </span>
            <button type="button" className="btn-ghost small" onClick={() => setSettingsOpen(true)}>
              设置
            </button>
          </div>
        </header>

        <main className="workspace">
          <StagePanel
            persona={persona}
            settings={settings}
            speaking={speaking}
            emotion={emotion}
            pulseRef={pulseRef}
            booting={booting}
            onModelState={handleModelState}
          />
          <ChatPanel
            persona={persona}
            onPersonaChange={handlePersonaChange}
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            settings={settings}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={chat.stop}
            onRegenerate={chat.regenerate}
            onRemove={chat.removeMessage}
            onSpeak={tts.speak}
            onClear={handleClear}
            onExport={handleExport}
            onOpenSettings={() => setSettingsOpen(true)}
            speech={speech}
          />
        </main>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onPatch={patchSettings}
        voices={tts.voices}
        ttsSupported={tts.supported}
        onClearHistory={handleClear}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Workspace />
    </ToastProvider>
  );
}
