// frontend/src/App.jsx
import React, { useState } from 'react';
import Live2DView from './components/Live2DView';
import ChatBox from './components/ChatBox';
import './App.css';

// 预设背景列表
const BACKGROUNDS = [
  { name: '星夜', style: 'bg-starry' },
  { name: '樱花', style: 'bg-sakura' },
  { name: '教室', style: 'bg-classroom' },
  { name: '简约', style: 'bg-simple' },
];

function App() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bgClass, setBgClass] = useState('bg-starry'); // 默认星夜

  return (
    <div className="app">
      <div className={`live2d-panel ${bgClass}`}>
        <Live2DView isSpeaking={isSpeaking} />
        {/* 背景切换按钮组 */}
        <div className="bg-switcher">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.style}
              className={`bg-btn ${bgClass === bg.style ? 'active' : ''}`}
              onClick={() => setBgClass(bg.style)}
              title={bg.name}
            >
              {bg.name}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-panel">
        <ChatBox onSpeakingChange={setIsSpeaking} />
      </div>
    </div>
  );
}

export default App;