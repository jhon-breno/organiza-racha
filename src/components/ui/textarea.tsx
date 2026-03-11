import { cn } from "@/lib/utils";
import * as React from "react";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-teal-500",
        className,
      )}
      {...props}
    />
  );
}
