import { useEffect, useState } from 'react';

const TIPS = [
  '正在为看板娘梳妆打扮…',
  '正在铺开一片樱花色的天空…',
  '正在连接大脑（DeepSeek）…',
  '正在调好 microphone 的音量…',
];

export default function Splash({ visible }) {
  const [tip, setTip] = useState(TIPS[0]);

  useEffect(() => {
    if (!visible) return undefined;
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % TIPS.length;
      setTip(TIPS[index]);
    }, 900);
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={`splash ${visible ? '' : 'splash-out'}`}>
      <div className="splash-inner">
        <div className="splash-orb">
          <span className="splash-petal" />
          <span className="splash-petal" />
          <span className="splash-petal" />
          <span className="splash-petal" />
          <span className="splash-petal" />
          <span className="splash-core">🌸</span>
        </div>
        <h1 className="splash-title">Avatar Chatbot</h1>
        <p className="splash-tip">{tip}</p>
      </div>
    </div>
  );
}
