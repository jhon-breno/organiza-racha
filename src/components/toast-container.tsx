"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed right-4 bottom-4 z-70 flex flex-col-reverse gap-2"
      role="region"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const isSuccess = toast.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "copy-toast-cycle flex w-[min(92vw,28rem)] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{toast.message}</p>
      <button
        onClick={onClose}
        className="mt-0.5 text-opacity-60 hover:text-opacity-100"
        aria-label="Fechar notificação"
      >
        ✕
      </button>
    </div>
  );
}
