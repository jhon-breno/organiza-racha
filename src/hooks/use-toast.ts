import { useCallback, useState } from "react";

export type ToastType = "success" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      const toast: Toast = { id, message, type };

      setToasts((prevToasts) => [...prevToasts, toast]);

      const timeout = setTimeout(() => {
        removeToast(id);
      }, 3000);

      return () => clearTimeout(timeout);
    },
    [removeToast],
  );

  return { toasts, addToast, removeToast };
}
