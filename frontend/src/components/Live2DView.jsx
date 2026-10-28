import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

// 注意：oh-my-live2d 在模块加载时就会校验 window.Live2D（Cubism 2.1 运行时，见 index.html），
// 因此这里用动态 import + try/catch，避免运行时缺失时整个应用白屏。
let oml2dModulePromise = null;
function loadOml2dModule() {
  if (!oml2dModulePromise) {
    oml2dModulePromise = import('oh-my-live2d');
  }
  return oml2dModulePromise;
}

// oh-my-live2d 只暴露了 setModelScale / setModelPosition 等高层 API，
// 口型与表情需要触达底层的 pixi-live2d-display 模型，这里做层层降级，失败也不影响主流程。

const CUBISM2_MOUTH = 'PARAM_MOUTH_OPEN_Y';
const CUBISM4_MOUTH = 'ParamMouthOpenY';

const EMOTION_EXPRESSION = {
  happy: 'f01',
  shy: 'f02',
  sad: 'f03',
  angry: 'f04',
  surprise: 'f05',
  calm: 'f06',
};

const EMOTION_MOTION = {
  happy: ['tapBody', 0],
  shy: ['tapBody', 2],
  sad: ['idle', 2],
  angry: ['shake', 0],
  surprise: ['flickHead', 0],
  calm: ['idle', 0],
};

function getCoreModel(instance) {
  return instance?.models?.model?.internalModel?.coreModel || null;
}

function setParam(core, value) {
  if (!core) return false;
  try {
    if (typeof core.setParameterValueById === 'function') {
      core.setParameterValueById(CUBISM4_MOUTH, value);
      return true;
    }
    if (typeof core.setParamFloat === 'function') {
      core.setParamFloat(CUBISM2_MOUTH, value);
      return true;
    }
  } catch {
    /* 参数名不存在时忽略 */
  }
  return false;
}

const Live2DView = forwardRef(function Live2DView(
  {
    modelPath = '/models/haru/haru01.model.json',
    scale = 0.09,
    offsetX = 0,
    offsetY = 55,
    visible = true,
    speaking = false,
    mouthSync = true,
    emotion = null,
    pulseRef = null,
    onState,
  },
  ref,
) {
  const hostRef = useRef(null);
  const omlRef = useRef(null);
  const rafRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // 初始化：只在挂载 / 模型文件变化时创建实例
  useEffect(() => {
    if (!visible || !hostRef.current) return undefined;
    let disposed = false;
    let instance = null;

    const mount = async () => {
      try {
        const { loadOml2d } = await loadOml2dModule();
        if (disposed || !hostRef.current) return;
        instance = loadOml2d({
          models: [
            {
              path: modelPath,
              position: [offsetX, offsetY],
              mobilePosition: [offsetX, offsetY],
              scale,
              mobileScale: scale * 0.9,
            },
          ],
          parentElement: hostRef.current,
          dockedPosition: 'left',
          statusBar: { disabled: true },
          menus: { disabled: true },
          tips: { disabled: true },
        });
        omlRef.current = instance;

        instance.onLoad?.((status) => {
          if (disposed) return;
          if (status === 'success') {
            setFailed(false);
            setReady(true);
            onState?.('ready');
          } else if (status === 'fail') {
            console.warn('[Live2D] 模型加载失败，已降级为占位形象：', modelPath);
            setFailed(true);
            onState?.('error');
          }
        });
      } catch (error) {
        console.error('[Live2D] 初始化失败：', error);
        if (disposed) return;
        setFailed(true);
        onState?.('error');
      }
    };
    mount();

    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      try {
        omlRef.current?.stage?.unMount?.();
      } catch {
        /* ignore */
      }
      omlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath, visible, onState]);

  // 缩放与位置：使用官方 API 实时更新，避免重建实例
  useEffect(() => {
    const instance = omlRef.current;
    if (!instance || !ready) return;
    try {
      instance.setModelScale?.(scale);
      instance.setModelPosition?.({ x: offsetX, y: offsetY });
    } catch {
      /* ignore */
    }
  }, [offsetX, offsetY, ready, scale]);

  // 口型同步：说话时正弦开合，收到 TTS 边界事件时短暂加强
  useEffect(() => {
    const instance = omlRef.current;
    const core = getCoreModel(instance);
    if (!core || !mouthSync) {
      if (core) setParam(core, 0);
      return undefined;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!speaking) {
      setParam(core, 0);
      return undefined;
    }

    const start = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      const base = 0.4 + 0.35 * Math.sin(elapsed * 13);
      const boost = pulseRef?.current && performance.now() - pulseRef.current < 150 ? 0.25 : 0;
      setParam(core, Math.max(0, Math.min(1, base + boost)));
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [mouthSync, pulseRef, ready, speaking]);

  // 情绪 → 表情 / 动作
  useEffect(() => {
    const instance = omlRef.current;
    const model = instance?.models?.model;
    if (!model || !ready || !emotion) return;
    try {
      const expressionId = EMOTION_EXPRESSION[emotion];
      const applied = expressionId ? model.expression?.(expressionId) : null;
      if (!applied) {
        const motion = EMOTION_MOTION[emotion];
        if (motion) model.motion?.(motion[0], motion[1]);
      }
    } catch {
      /* ignore */
    }
  }, [emotion, ready]);

  const poke = useCallback(() => {
    const model = omlRef.current?.models?.model;
    if (!model) return false;
    try {
      model.motion?.('tapBody', Math.floor(Math.random() * 8));
      return true;
    } catch {
      return false;
    }
  }, []);

  useImperativeHandle(ref, () => ({ poke }));

  return (
    <div className="live2d-host" ref={hostRef}>
      {failed ? (
        <div className="live2d-fallback">
          <div className="fallback-figure">
            <span className="fallback-face">🌸</span>
            <span className="fallback-body" />
          </div>
          <p className="fallback-hint">Live2D 模型加载失败，先用这只小花妖顶一下～</p>
        </div>
      ) : null}
      {!visible ? <div className="live2d-hidden-hint">看板娘已在设置中隐藏</div> : null}
    </div>
  );
});

export default Live2DView;
