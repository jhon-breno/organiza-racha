import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-teal-600 px-4 py-2.5 text-white hover:bg-teal-700",
        secondary: "bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800",
        outline:
          "border border-slate-200 bg-white px-4 py-2.5 text-slate-900 hover:bg-slate-50",
        ghost: "px-3 py-2 text-slate-700 hover:bg-slate-100",
        danger: "bg-rose-600 px-4 py-2.5 text-white hover:bg-rose-700",
      },
      size: {
        default: "h-11",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    href?: string;
    target?: React.HTMLAttributeAnchorTarget;
    rel?: string;
  };

export function Button({
  className,
  variant,
  size,
  asChild,
  href,
  target,
  rel,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild && href) {
    return (
      <Link className={classes} href={href} rel={rel} target={target}>
        {props.children}
      </Link>
    );
  }

  return <button className={classes} {...props} />;
}

export { buttonVariants };
