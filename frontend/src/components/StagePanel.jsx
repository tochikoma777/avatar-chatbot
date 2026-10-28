import { useCallback, useRef, useState } from 'react';

import { DEFAULT_SCENE_ID, getScene } from '../config/scenes';
import { generateImage } from '../services/api';
import BackgroundStudio from './BackgroundStudio';
import Live2DView from './Live2DView';
import SceneEffects from './SceneEffects';
import useToast from '../hooks/useToast';
import usePersistedState from '../hooks/usePersistedState';

const MODEL_PATH = '/models/haru/haru01.model.json';

const EMOTION_LABEL = {
  happy: '开心',
  shy: '害羞',
  sad: '低落',
  angry: '生气',
  surprise: '惊讶',
  calm: '平静',
};

export default function StagePanel({
  persona,
  settings,
  speaking,
  emotion,
  pulseRef,
  booting,
  onModelState,
}) {
  const toast = useToast();
  const modelRef = useRef(null);
  const [sceneId, setSceneId] = usePersistedState('avatar-chat.scene', DEFAULT_SCENE_ID);
  const [aiBackground, setAiBackground] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('anime');
  const [loading, setLoading] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [gallery, setGallery] = useState([]);
  const gallerySeq = useRef(0);

  const scene = getScene(sceneId);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    toast('AI 正在绘制背景，请稍候～');
    try {
      const data = await generateImage({ prompt: prompt.trim(), style, width: 1280, height: 800 });
      if (!data?.image_data) throw new Error('返回内容为空');
      gallerySeq.current += 1;
      const item = { id: `gen_${gallerySeq.current}`, url: data.image_data, label: prompt.trim() };
      setGallery((prev) => [item, ...prev].slice(0, 6));
      setAiBackground(data.image_data);
      toast(data.fallback ? '在线生成超时，已用本地程序化背景兜底' : '背景生成完成 ✨', data.fallback ? 'info' : 'success');
    } catch (error) {
      toast(error.message || '生成失败，请稍后再试', 'error');
    } finally {
      setLoading(false);
    }
  }, [loading, prompt, style, toast]);

  const handleUpload = useCallback((dataUrl, name) => {
    gallerySeq.current += 1;
    const item = { id: `up_${gallerySeq.current}`, url: dataUrl, label: name || '自定义背景' };
    setGallery((prev) => [item, ...prev].slice(0, 6));
    setAiBackground(dataUrl);
    toast('已应用自定义背景 🖼️', 'success');
  }, [toast]);

  const handleSelectScene = useCallback((id) => {
    setSceneId(id);
    setAiBackground(null);
  }, [setSceneId]);

  return (
    <section className="stage" aria-label="看板娘舞台">
      <div className={`stage-scene scene-${scene.id}`}>
        {aiBackground ? (
          <div
            className="stage-ai-bg"
            style={{ backgroundImage: `url("${aiBackground}")` }}
            key={aiBackground.slice(-32)}
          />
        ) : null}
        <div className="stage-aurora" />
        <SceneEffects effect={scene.effect} level={settings.effectsLevel} />
        <div className="stage-vignette" />
      </div>

      <div className="stage-character">
        <Live2DView
          ref={modelRef}
          modelPath={MODEL_PATH}
          scale={settings.modelScale}
          offsetX={settings.modelOffsetX}
          offsetY={settings.modelOffsetY}
          visible={settings.showModel}
          speaking={speaking}
          mouthSync={settings.mouthSync}
          emotion={emotion}
          pulseRef={pulseRef}
          onState={onModelState}
        />
      </div>

      <div className="stage-hud">
        <div className="character-card">
          <div className="character-avatar" style={{ '--persona-accent': persona.accent }}>
            <span>{persona.emoji}</span>
          </div>
          <div className="character-meta">
            <strong>{persona.name}</strong>
            <span>{persona.tagline}</span>
          </div>
          <div className={`mood-chip ${emotion || 'calm'} ${speaking ? 'speaking' : ''}`}>
            {speaking ? '说话中' : EMOTION_LABEL[emotion] || '待机中'}
          </div>
        </div>

        <div className="stage-actions">
          <button
            type="button"
            className="btn-ghost poke-btn"
            onClick={() => modelRef.current?.poke()}
            title="戳一戳"
          >
            戳一戳 👆
          </button>
        </div>
      </div>

      {!booting ? (
        <BackgroundStudio
          open={dockOpen}
          onToggle={() => setDockOpen((v) => !v)}
          sceneId={sceneId}
          onSelectScene={handleSelectScene}
          prompt={prompt}
          onPromptChange={setPrompt}
          style={style}
          onStyleChange={setStyle}
          onGenerate={handleGenerate}
          loading={loading}
          gallery={gallery}
          onApplyImage={(item) => setAiBackground(item.url)}
          onRemoveImage={(id) => setGallery((prev) => prev.filter((item) => item.id !== id))}
          onUpload={handleUpload}
          onClearAi={() => setAiBackground(null)}
          hasAiBackground={Boolean(aiBackground)}
        />
      ) : null}

      {loading ? <div className="stage-loading">AI 正在绘制背景…</div> : null}
    </section>
  );
}
