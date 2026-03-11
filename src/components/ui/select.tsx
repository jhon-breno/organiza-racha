import { cn } from "@/lib/utils";
import * as React from "react";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 focus:border-teal-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
