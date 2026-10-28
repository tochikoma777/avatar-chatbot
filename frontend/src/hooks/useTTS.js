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
  boundaryRef.current = onBoundary;

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
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text?.trim()) return;
      window.speechSynthesis.cancel();

      const chunks = splitText(text.replace(/[*`#>|]/g, ''));
      const voice = pickVoice(voices, settings.voiceURI, 'zh-CN');
      let index = 0;

      const speakNext = () => {
        if (index >= chunks.length) {
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = voice?.lang || 'zh-CN';
        if (voice) utterance.voice = voice;
        utterance.rate = settings.rate ?? 1;
        utterance.pitch = settings.pitch ?? 1;
        utterance.volume = settings.volume ?? 1;
        utterance.onboundary = () => boundaryRef.current?.();
        utterance.onend = () => {
          index += 1;
          speakNext();
        };
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      };

      setSpeaking(true);
      speakNext();
    },
    [settings.rate, settings.pitch, settings.volume, settings.voiceURI, supported, voices],
  );

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { speak, cancel, speaking, voices, supported };
}
