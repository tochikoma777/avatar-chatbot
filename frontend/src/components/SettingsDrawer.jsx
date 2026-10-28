import { useEffect, useState } from 'react';

import { ACCENT_THEMES, ASR_LANGS, EFFECT_LEVELS } from '../config/settings';
import { IconClose } from './Icons';

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="setting-row">
      <span className="setting-label">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange?.(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </label>
  );
}

function RangeControl({ label, value, min, max, step, onCommit, format }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div className="setting-row">
      <span className="setting-label">
        {label}
        <em>{format ? format(local) : local}</em>
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => onCommit?.(local)}
        onKeyUp={() => onCommit?.(local)}
        onBlur={() => onCommit?.(local)}
      />
    </div>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={String(value) === String(option.id) ? 'active' : ''}
            onClick={() => onChange?.(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsDrawer({
  open,
  onClose,
  settings,
  onPatch,
  voices,
  ttsSupported,
  onClearHistory,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-mask ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-label="设置">
        <header className="drawer-header">
          <h3>偏好设置</h3>
          <button type="button" className="icon-btn" onClick={onClose} title="关闭">
            <IconClose width={18} height={18} />
          </button>
        </header>

        <div className="drawer-body">
          <section className="setting-group">
            <h4>🔊 语音合成</h4>
            {!ttsSupported ? <p className="setting-warn">当前浏览器不支持语音合成</p> : null}
            <Switch
              label="自动朗读回复"
              hint="关闭后仍可点气泡上的喇叭按钮"
              checked={settings.autoSpeak}
              onChange={(v) => onPatch({ autoSpeak: v })}
            />
            <label className="setting-row">
              <span className="setting-label">发音人</span>
              <select
                className="select"
                value={settings.voiceURI}
                onChange={(e) => onPatch({ voiceURI: e.target.value })}
              >
                <option value="">自动选择（优先中文女声）</option>
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
            <RangeControl
              label="语速"
              value={settings.rate}
              min={0.6}
              max={1.8}
              step={0.05}
              onCommit={(v) => onPatch({ rate: v })}
              format={(v) => `${v.toFixed(2)}x`}
            />
            <RangeControl
              label="音调"
              value={settings.pitch}
              min={0.5}
              max={1.8}
              step={0.05}
              onCommit={(v) => onPatch({ pitch: v })}
              format={(v) => `${v.toFixed(2)}`}
            />
            <RangeControl
              label="音量"
              value={settings.volume}
              min={0}
              max={1}
              step={0.05}
              onCommit={(v) => onPatch({ volume: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </section>

          <section className="setting-group">
            <h4>🎤 语音输入</h4>
            <Switch
              label="启用麦克风按钮"
              checked={settings.asrEnabled}
              onChange={(v) => onPatch({ asrEnabled: v })}
            />
            <label className="setting-row">
              <span className="setting-label">识别语言</span>
              <select
                className="select"
                value={settings.asrLang}
                onChange={(e) => onPatch({ asrLang: e.target.value })}
              >
                {ASR_LANGS.map((lang) => (
                  <option key={lang.id} value={lang.id}>{lang.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="setting-group">
            <h4>🎭 看板娘</h4>
            <Switch
              label="显示 Live2D 模型"
              checked={settings.showModel}
              onChange={(v) => onPatch({ showModel: v })}
            />
            <Switch
              label="口型同步"
              hint="说话时驱动嘴部参数"
              checked={settings.mouthSync}
              onChange={(v) => onPatch({ mouthSync: v })}
            />
            <RangeControl
              label="模型缩放"
              value={settings.modelScale}
              min={0.04}
              max={0.18}
              step={0.005}
              onCommit={(v) => onPatch({ modelScale: v })}
              format={(v) => v.toFixed(3)}
            />
            <RangeControl
              label="水平位置"
              value={settings.modelOffsetX}
              min={-200}
              max={200}
              step={5}
              onCommit={(v) => onPatch({ modelOffsetX: v })}
            />
            <RangeControl
              label="垂直位置"
              value={settings.modelOffsetY}
              min={-100}
              max={180}
              step={5}
              onCommit={(v) => onPatch({ modelOffsetY: v })}
            />
          </section>

          <section className="setting-group">
            <h4>🎀 界面</h4>
            <Segmented
              label="场景特效"
              value={settings.effectsLevel}
              options={EFFECT_LEVELS}
              onChange={(v) => onPatch({ effectsLevel: v })}
            />
            <Segmented
              label="主题色"
              value={settings.themeAccent}
              options={ACCENT_THEMES}
              onChange={(v) => onPatch({ themeAccent: v })}
            />
            <Switch
              label="气泡动画"
              checked={settings.bubbleAnimation}
              onChange={(v) => onPatch({ bubbleAnimation: v })}
            />
            <Switch
              label="显示时间戳"
              checked={settings.showTimestamps}
              onChange={(v) => onPatch({ showTimestamps: v })}
            />
          </section>

          <section className="setting-group">
            <h4>💬 对话</h4>
            <Switch
              label="允许调用工具"
              hint="时间 / 天气 / 计算 / 冷知识等"
              checked={settings.enableTools}
              onChange={(v) => onPatch({ enableTools: v })}
            />
            <label className="setting-row column">
              <span className="setting-label">
                自定义人设
                <em>留空则使用角色默认人设</em>
              </span>
              <textarea
                className="textarea"
                rows={3}
                value={settings.customPersona}
                placeholder="例如：你是一个喜欢用颜文字的魔法少女…"
                onChange={(e) => onPatch({ customPersona: e.target.value })}
              />
            </label>
            <button type="button" className="btn-danger" onClick={onClearHistory}>
              清空当前角色的对话记录
            </button>
          </section>
        </div>
      </aside>
    </>
  );
}
