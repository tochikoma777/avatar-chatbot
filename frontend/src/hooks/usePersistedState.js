import { useEffect, useRef, useState } from 'react';

function read(key, initialValue, merge) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return initialValue;
    const parsed = JSON.parse(raw);
    if (merge && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { ...initialValue, ...parsed };
    }
    return parsed;
  } catch {
    return initialValue;
  }
}

/** 带 localStorage 持久化的 state；key 变化时会自动重新读取（用于按角色切换历史）。 */
export default function usePersistedState(key, initialValue, { merge = false } = {}) {
  const [value, setValue] = useState(() => read(key, initialValue, merge));
  const currentKey = useRef(key);

  if (currentKey.current !== key) {
    currentKey.current = key;
    setValue(read(key, initialValue, merge));
  }

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 超出配额时静默失败 */
    }
  }, [key, value]);

  return [value, setValue];
}
