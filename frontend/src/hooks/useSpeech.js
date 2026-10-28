import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null;

/** 浏览器语音识别（ASR），带实时字幕与错误回调。 */
export default function useSpeech({ lang = 'zh-CN', onFinal, onError } = {}) {
  const supported = Boolean(SpeechRecognition);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);
  const finalRef = useRef(onFinal);
  const errorRef = useRef(onError);
  finalRef.current = onFinal;
  errorRef.current = onError;

  useEffect(() => {
    if (!supported) return undefined;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) finalRef.current?.(finalText.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      setInterim('');
      errorRef.current?.(event.error);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang, supported]);

  const start = useCallback(() => {
    if (!supported || !recognitionRef.current) return;
    setInterim('');
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [supported]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { supported, listening, interim, start, stop };
}
