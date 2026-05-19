"use client";
import * as React from "react";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Salvando...",
  variant,
  size,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      className={className}
      disabled={pending || disabled}
      size={size}
      variant={variant}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
