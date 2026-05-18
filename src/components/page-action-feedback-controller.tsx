"use client";

import { useEffect } from "react";

const PAGE_ACTION_SCROLL_KEY = "page-action-scroll-state";

type StoredScrollState = {
  pathname: string;
  scrollY: number;
  savedAt: number;
};

function readStoredScrollState() {
  const rawValue = sessionStorage.getItem(PAGE_ACTION_SCROLL_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredScrollState;
  } catch {
    sessionStorage.removeItem(PAGE_ACTION_SCROLL_KEY);
    return null;
  }
}

export function PageActionFeedbackController({
  scopeId,
  status,
  field,
}: {
  scopeId: string;
  status?: string;
  field?: string;
}) {
  useEffect(() => {
    const scopeElement = document.getElementById(scopeId);

    if (!scopeElement) {
      return;
    }

    const handleSubmit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) {
        return;
      }

      sessionStorage.setItem(
        PAGE_ACTION_SCROLL_KEY,
        JSON.stringify({
          pathname: window.location.pathname,
          scrollY: window.scrollY,
          savedAt: Date.now(),
        } satisfies StoredScrollState),
      );
    };

    scopeElement.addEventListener("submit", handleSubmit, true);

    return () => {
      scopeElement.removeEventListener("submit", handleSubmit, true);
    };
  }, [scopeId]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const storedState = readStoredScrollState();

    if (!storedState) {
      return;
    }

    const isFreshState = Date.now() - storedState.savedAt < 15000;
    const isSamePath = storedState.pathname === window.location.pathname;

    if (!isFreshState || !isSamePath) {
      sessionStorage.removeItem(PAGE_ACTION_SCROLL_KEY);
      return;
    }

    if (status === "error" && field) {
      sessionStorage.removeItem(PAGE_ACTION_SCROLL_KEY);
      return;
    }

    const restoreScroll = () => {
      window.scrollTo({ top: storedState.scrollY, behavior: "auto" });
      sessionStorage.removeItem(PAGE_ACTION_SCROLL_KEY);
    };

    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
  }, [field, status]);

  useEffect(() => {
    if (status !== "error" || !field) {
      return;
    }

    const scopeElement = document.getElementById(scopeId);

    if (!scopeElement) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = scopeElement.querySelector<HTMLElement>(
        `[name="${CSS.escape(field)}"]`,
      );

      if (!target) {
        return;
      }

      target.focus();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [field, scopeId, status]);

  return null;
}