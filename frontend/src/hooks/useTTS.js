import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_CHUNK = 160;
const SENTENCE_SPLIT = /(?<=[。！？!?；;\n])/;

function splitText(text) {
  const chunks = [];
  let current = '';
  for (const part of text.split(SENTENCE_SPLIT)) {
    if ((current + part).length > MAX_CHUNK && current) {
      chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks.filter((c) => c.trim());
}

function pickVoice(voices, preferredURI, lang = 'zh-CN') {
  if (preferredURI) {
    const found = voices.find((v) => v.voiceURI === preferredURI);
    if (found) return found;
  }
  const langVoices = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  if (langVoices.length) {
    const female = langVoices.find((v) => /female|婷婷|小艺|晓晓|mei|xiaoxiao|yaoyao/i.test(v.name));
    return female || langVoices[0];
  }
  return null;
}

/** 浏览器语音合成：分句朗读 + 边界事件用于口型同步。 */
export default function useTTS(settings, { onBoundary } = {}) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const boundaryRef = useRef(onBoundary);
  const watchdogRef = useRef(0);
  boundaryRef.current = onBoundary;

  // 部分浏览器（尤其 Chrome）在长句/被取消时会漏发 onend，导致 speaking 永久为 true，
  // 表现为「一直显示说话中、口型不停」。这里用看门狗兜底复位。
  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices() || []);
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    clearWatchdog();
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [clearWatchdog, supported]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text?.trim()) return;
      clearWatchdog();
      window.speechSynthesis.cancel();

      const chunks = splitText(text.replace(/[*`#>|]/g, ''));
      const voice = pickVoice(voices, settings.voiceURI, 'zh-CN');
      const rate = settings.rate ?? 1;
      let index = 0;

      const finish = () => {
        clearWatchdog();
        setSpeaking(false);
      };

      const speakNext = () => {
        if (index >= chunks.length) {
          finish();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = voice?.lang || 'zh-CN';
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = settings.pitch ?? 1;
        utterance.volume = settings.volume ?? 1;
        utterance.onboundary = () => boundaryRef.current?.();
        utterance.onend = () => {
          index += 1;
          speakNext();
        };
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);
      };

      setSpeaking(true);

      // 预估时长：中文约 0.28s/字（按语速换算），额外留 4s 余量，上限 3 分钟。
      const chars = chunks.join('').length;
      const estimate = Math.min(180000, ((chars * 0.28) / Math.max(rate, 0.5) + 4) * 1000);
      watchdogRef.current = window.setTimeout(() => {
        watchdogRef.current = 0;
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
        setSpeaking(false);
      }, estimate);

      speakNext();
    },
    [clearWatchdog, settings.pitch, settings.rate, settings.volume, settings.voiceURI, supported, voices],
  );

  useEffect(() => () => {
    clearWatchdog();
    if (supported) window.speechSynthesis.cancel();
  }, [clearWatchdog, supported]);

  return { speak, cancel, speaking, voices, supported };
}
