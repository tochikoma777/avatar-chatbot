import { useRef, useState } from 'react';

import { IMAGE_STYLES, SCENE_PROMPT_PLACEHOLDERS, SCENES } from '../config/scenes';
import { IconChevron, IconClose, IconImage, IconSparkles, IconUpload } from './Icons';
import useToast from '../hooks/useToast';

export default function BackgroundStudio({
  open,
  onToggle,
  sceneId,
  onSelectScene,
  prompt,
  onPromptChange,
  style,
  onStyleChange,
  onGenerate,
  loading,
  gallery,
  onApplyImage,
  onRemoveImage,
  onUpload,
  onClearAi,
  hasAiBackground,
}) {
  const fileRef = useRef(null);
  const toast = useToast();
  const [placeholder] = useState(
    () => SCENE_PROMPT_PLACEHOLDERS[Math.floor(Math.random() * SCENE_PROMPT_PLACEHOLDERS.length)],
  );

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast('图片太大啦，请控制在 6MB 以内', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpload?.(reader.result, file.name);
    reader.onerror = () => toast('读取图片失败', 'error');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className={`bg-studio ${open ? 'open' : 'closed'}`}>
      <button type="button" className="bg-studio-toggle" onClick={onToggle} aria-expanded={open}>
        <IconImage width={16} height={16} />
        <span>背景工坊</span>
        <span className={`chev ${open ? 'up' : ''}`}><IconChevron width={14} height={14} /></span>
      </button>

      {open ? (
        <div className="bg-studio-body">
          <div className="scene-row">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                type="button"
                className={`scene-chip ${sceneId === scene.id && !hasAiBackground ? 'active' : ''}`}
                onClick={() => onSelectScene?.(scene.id)}
              >
                <span className="scene-emoji">{scene.emoji}</span>
                {scene.name}
              </button>
            ))}
          </div>

          <div className="ai-row">
            <input
              className="ai-input"
              value={prompt}
              placeholder={placeholder}
              onChange={(e) => onPromptChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onGenerate?.();
              }}
            />
            <button
              type="button"
              className="btn-primary ai-generate"
              onClick={() => onGenerate?.()}
              disabled={loading || !prompt.trim()}
            >
              <IconSparkles width={16} height={16} />
              {loading ? '绘制中…' : '生成'}
            </button>
          </div>

          <div className="style-row">
            {IMAGE_STYLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`style-chip ${style === item.id ? 'active' : ''}`}
                onClick={() => onStyleChange?.(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="studio-tools">
            <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <IconUpload width={15} height={15} /> 上传图片
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
            {hasAiBackground ? (
              <button type="button" className="btn-ghost" onClick={() => onClearAi?.()}>
                <IconClose width={15} height={15} /> 清除 AI 背景
              </button>
            ) : null}
          </div>

          {gallery.length ? (
            <div className="gallery">
              {gallery.map((item) => (
                <div key={item.id} className="gallery-item">
                  <button
                    type="button"
                    className="gallery-thumb"
                    style={{ backgroundImage: `url("${item.url}")` }}
                    onClick={() => onApplyImage?.(item)}
                    title={item.label}
                  />
                  <button
                    type="button"
                    className="gallery-remove"
                    onClick={() => onRemoveImage?.(item.id)}
                    title="移除"
                  >
                    <IconClose width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
