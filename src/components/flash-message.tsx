"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_EXIT_MS = 280;

export function FlashMessage({
  status,
  message,
}: {
  status?: string;
  message?: string;
}) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const nextParams = new URLSearchParams(currentUrl.search);
    const hasStatus = nextParams.has("status");
    const hasMessage = nextParams.has("message");

    if (!hasStatus && !hasMessage) {
      return;
    }

    nextParams.delete("status");
    nextParams.delete("message");

    const query = nextParams.toString();
    const nextUrl = `${currentUrl.pathname}${query ? `?${query}` : ""}${currentUrl.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <FlashMessageToast
      key={`${status ?? ""}:${message}`}
      message={message}
      status={status}
    />
  );
}

function FlashMessageToast({
  status,
  message,
}: {
  status?: string;
  message: string;
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const durationMs = useMemo(() => {
    return Math.min(14000, Math.max(4000, 2500 + message.length * 45));
  }, [message]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsClosing(true);
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [durationMs]);

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, TOAST_EXIT_MS);

    return () => window.clearTimeout(timeout);
  }, [isClosing]);

  if (!isVisible) {
    return null;
  }

  const success = status === "success";
  const Icon = success ? CheckCircle2 : AlertCircle;

  return (
    <div
      aria-live="polite"
      role="status"
      className={cn(
        "fixed right-4 top-4 z-50 flex w-[min(92vw,28rem)] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur",
        isClosing ? "toast-exit" : "toast-enter",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
