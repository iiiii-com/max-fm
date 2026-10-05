"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";
type Size = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-hairline hover:bg-primary-hover active:bg-primary-hover",
  secondary:
    "bg-secondary text-secondary-foreground border border-border/70 hover:bg-muted hover:border-border",
  outline:
    "border border-border bg-card text-foreground shadow-hairline hover:bg-subtle hover:border-border-strong",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-hairline hover:opacity-90",
  link: "text-primary underline-offset-4 hover:underline p-0 h-auto",
};

const sizes: Record<Size, string> = {
  xs: "h-6 gap-1 px-2 text-[11px] rounded-[5px]",
  sm: "h-7 gap-1.5 px-2.5 text-xs rounded-md",
  md: "h-8 gap-1.5 px-3 text-[13px] rounded-md",
  lg: "h-10 gap-2 px-4 text-sm rounded-lg",
  "icon-xs": "size-6 rounded-[5px]",
  "icon-sm": "size-7 rounded-md",
  icon: "size-8 rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,opacity,transform] duration-150",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant !== "link" && "[&_svg]:size-[1em] [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
