// frontend/src/components/Live2DView.jsx
import React, { useEffect, useRef } from 'react';
import { loadOml2d } from 'oh-my-live2d';

export default function Live2DView({ isSpeaking }) {
  const containerRef = useRef(null);
  const oml2dInstance = useRef(null);
  const mouthAnimationRef = useRef(null);

  // 初始化 Live2D
  useEffect(() => {
    if (containerRef.current && !oml2dInstance.current) {
      const instance = loadOml2d({
        models: [
          {
            path: '/models/haru/haru01.model.json',
            position: [0, 60],
            scale: 0.08,
          },
        ],
        statusBar: { disabled: true },
        menus: { disabled: true },
        tips: { disabled: true },
        dockedPosition: 'left',
        parentElement: containerRef.current,
      });

      oml2dInstance.current = instance;
    }

    return () => {
      if (oml2dInstance.current) {
        try {
          oml2dInstance.current.destroy?.();
        } catch (e) { /* ignore */ }
        oml2dInstance.current = null;
      }
    };
  }, []);

  // 根据 isSpeaking 驱动口型动画
  useEffect(() => {
    const instance = oml2dInstance.current;
    if (!instance) return;

    // 取消旧动画
    if (mouthAnimationRef.current) {
      cancelAnimationFrame(mouthAnimationRef.current);
      mouthAnimationRef.current = null;
    }

    if (isSpeaking) {
      let startTime = Date.now();
      const animateMouth = () => {
        try {
          // oh-my-live2d 的官方 API，设置指定参数的值（范围 0~1）
          const elapsed = (Date.now() - startTime) / 1000;
          const value = 0.0 + 0.9 * (Math.sin(elapsed * 12) * 0.5 + 0.5);
          instance.setParameterValueByName('ParamMouthOpenY', value);
        } catch (e) { /* ignore */ }
        mouthAnimationRef.current = requestAnimationFrame(animateMouth);
      };
      animateMouth();
    } else {
      // 停止说话，嘴巴闭合
      try {
        instance.setParameterValueByName('ParamMouthOpenY', 0);
      } catch (e) { /* ignore */ }
    }

    return () => {
      if (mouthAnimationRef.current) {
        cancelAnimationFrame(mouthAnimationRef.current);
        mouthAnimationRef.current = null;
      }
    };
  }, [isSpeaking]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}