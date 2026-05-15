// frontend/src/App.jsx
import React, { useState } from 'react';
import Live2DView from './components/Live2DView';
import ChatBox from './components/ChatBox';
import './App.css';

const BACKGROUNDS = [
  { name: '星夜', style: 'bg-starry' },
  { name: '樱花', style: 'bg-sakura' },
  { name: '教室', style: 'bg-classroom' },
  { name: '简约', style: 'bg-simple' },
];

function App() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bgClass, setBgClass] = useState('bg-starry');
  // 新增：用于 AI 生成背景的图片 URL
  const [aiBgUrl, setAiBgUrl] = useState(null);

  return (
    <div className="app">
      <div className={`live2d-panel ${bgClass}`} style={aiBgUrl ? { backgroundImage: `url(${aiBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        <Live2DView isSpeaking={isSpeaking} />
        {/* 背景切换器 + AI 生成入口 */}
        <div className="bg-controls">
          <BackgroundGenerator onGenerated={setAiBgUrl} setBgClass={setBgClass} />
          <div className="bg-switcher">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.style}
                className={`bg-btn ${bgClass === bg.style && !aiBgUrl ? 'active' : ''}`}
                onClick={() => { setAiBgUrl(null); setBgClass(bg.style); }}
                title={bg.name}
              >
                {bg.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="chat-panel">
        <ChatBox onSpeakingChange={setIsSpeaking} />
      </div>
    </div>
  );
}

// 新的子组件：AI 背景生成器
function BackgroundGenerator({ onGenerated, setBgClass }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/generate/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.image_data) {
          onGenerated(data.image_data);   // 直接使用 base64 数据
          setBgClass('');
      } else {
          alert('生成失败，可能是网络超时，请用英文再试一次');
      }
    } catch (err) {
      alert('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-bg-generator">
      <input
        type="text"
        placeholder="描述想要的背景，如：星空下的樱花树"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
      />
      <button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
        {loading ? '生成中...' : '生成背景'}
      </button>
      {loading && <span className="generating-hint">AI 正在绘制，请稍候...</span>}
    </div>
  );
}

export default App;