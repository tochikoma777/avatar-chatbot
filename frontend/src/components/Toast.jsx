import { useCallback, useMemo, useRef, useState } from 'react';

import { ToastContext } from '../hooks/useToast';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info') => {
      const id = (idRef.current += 1);
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      window.setTimeout(() => dismiss(id), type === 'error' ? 4200 : 2800);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`toast toast-${toast.type}`}
            onClick={() => dismiss(toast.id)}
          >
            <span className="toast-icon">
              {toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : '✦'}
            </span>
            <span>{toast.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
