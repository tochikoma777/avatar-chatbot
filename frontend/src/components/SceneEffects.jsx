import { useMemo } from 'react';

// 场景粒子特效层：level 0 关闭 / 1 简约 / 2 华丽
const COUNT = {
  petals: 26,
  stars: 70,
  bokeh: 18,
  dust: 24,
};

function randomList(count, factory) {
  return Array.from({ length: count }, (_, i) => factory(i));
}

function Petals({ count }) {
  const items = useMemo(() => randomList(count, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 12,
    duration: 9 + Math.random() * 9,
    size: 10 + Math.random() * 14,
    sway: 40 + Math.random() * 120,
    opacity: 0.35 + Math.random() * 0.5,
    rotate: Math.random() * 360,
  })), [count]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {items.map((item, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${item.left}%`,
            width: `${item.size}px`,
            height: `${item.size * 0.62}px`,
            animationDelay: `${-item.delay}s`,
            animationDuration: `${item.duration}s`,
            opacity: item.opacity,
            '--sway': `${item.sway}px`,
            '--spin': `${item.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

function Stars({ count }) {
  const items = useMemo(() => randomList(count, () => ({
    left: Math.random() * 100,
    top: Math.random() * 78,
    size: 1 + Math.random() * 2.4,
    delay: Math.random() * 5,
    duration: 2.2 + Math.random() * 3.4,
  })), [count]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {items.map((item, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${item.left}%`,
            top: `${item.top}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            animationDelay: `${-item.delay}s`,
            animationDuration: `${item.duration}s`,
          }}
        />
      ))}
      {count > 20 ? (
        <>
          <span className="shooting-star shooting-star-1" />
          <span className="shooting-star shooting-star-2" />
        </>
      ) : null}
    </div>
  );
}

function Bokeh({ count, tint = 'rgba(255,214,170,0.55)' }) {
  const items = useMemo(() => randomList(count, () => ({
    left: Math.random() * 100,
    top: 20 + Math.random() * 70,
    size: 26 + Math.random() * 90,
    delay: Math.random() * 14,
    duration: 14 + Math.random() * 12,
    blur: 4 + Math.random() * 10,
  })), [count]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {items.map((item, i) => (
        <span
          key={i}
          className="bokeh"
          style={{
            left: `${item.left}%`,
            top: `${item.top}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            background: tint,
            filter: `blur(${item.blur}px)`,
            animationDelay: `${-item.delay}s`,
            animationDuration: `${item.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function Dust({ count }) {
  const items = useMemo(() => randomList(count, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 3 + Math.random() * 5,
    delay: Math.random() * 10,
    duration: 10 + Math.random() * 12,
  })), [count]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {items.map((item, i) => (
        <span
          key={i}
          className="dust"
          style={{
            left: `${item.left}%`,
            top: `${item.top}%`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            animationDelay: `${-item.delay}s`,
            animationDuration: `${item.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SceneEffects({ effect = 'none', level = 2 }) {
  if (!level || effect === 'none') return null;
  const scale = level === 1 ? 0.4 : 1;

  switch (effect) {
    case 'petals':
      return <Petals count={Math.round(COUNT.petals * scale)} />;
    case 'stars':
      return <Stars count={Math.round(COUNT.stars * scale)} />;
    case 'bokeh':
      return <Bokeh count={Math.round(COUNT.bokeh * scale)} />;
    case 'dust':
      return <Dust count={Math.round(COUNT.dust * scale)} />;
    case 'grid':
      return (
        <div className="fx-layer" aria-hidden="true">
          <span className="grid-floor" />
          {level === 2 ? <span className="grid-glow" /> : null}
        </div>
      );
    default:
      return null;
  }
}
