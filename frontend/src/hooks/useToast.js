import { createContext, useContext } from 'react';

export const ToastContext = createContext(() => {});

export default function useToast() {
  return useContext(ToastContext);
}
