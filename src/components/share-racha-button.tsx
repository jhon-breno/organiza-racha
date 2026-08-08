"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ShareRachaButtonProps = {
  slug: string;
  title: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
};

export function ShareRachaButton({
  slug,
  title,
  variant = "outline",
  className,
}: ShareRachaButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "";
    const shareUrl = `${origin}/rachas/${slug}?quickJoin=true`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite: ${title}`,
          text: `Entre no racha *${title}* agora!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  }

  return (
    <Button
      className={className}
      onClick={handleShare}
      type="button"
      variant={variant}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" />
          Link copiado!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          Compartilhar racha
        </>
      )}
    </Button>
  );
}
