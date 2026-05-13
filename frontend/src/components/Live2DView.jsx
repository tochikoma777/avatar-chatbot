// frontend/src/components/Live2DView.jsx
import React, { useEffect, useRef } from 'react';
import { loadOml2d } from 'oh-my-live2d';

export default function Live2DView({ isSpeaking }) {
  const containerRef = useRef(null);
  const oml2dInstance = useRef(null);

  useEffect(() => {
    // 确保只加载一次
    if (containerRef.current && !oml2dInstance.current) {
      const instance = loadOml2d({
        models: [
          {
            path: '/models/haru/haru01.model.json',
            position: [10, 50],
            scale: 0.08,
          },
        ],
        statusBar: {
          disabled: true,
        },
        menus: {
          disabled: true,
        },
        tips: {
          disabled: true,
        },
        dockedPosition: 'left',
        parentElement: containerRef.current,
      });

      oml2dInstance.current = instance;
    }

    return () => {
      if (oml2dInstance.current) {
        // oh-my-live2d 实例可能通过 .destroy() 方法清理，但需确认
        // 若没有则尝试 null
        try {
          oml2dInstance.current?.destroy?.();
        } catch (e) {}
        oml2dInstance.current = null;
      }
    };
  }, []);

  // 保留口型同步接口（后续可继续扩展）
  useEffect(() => {
    // 目前 oh-my-live2d 的口型同步暂未启用
  }, [isSpeaking]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}