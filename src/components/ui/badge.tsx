import { cn } from "@/lib/utils";
import * as React from "react";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700",
        className,
      )}
      {...props}
    />
  );
}
