"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-input bg-subtle px-3 text-[13px] text-foreground shadow-hairline " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "placeholder:text-subtle-foreground/80 " +
  "focus-visible:border-ring/70 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 " +
  "disabled:cursor-not-allowed disabled:opacity-55";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-8", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} rows={3} className={cn(base, "resize-y py-2 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      base,
      "h-8 cursor-pointer appearance-none bg-[image:var(--select-arrow)] bg-[position:right_0.5rem_center] bg-[size:0.9rem] bg-no-repeat pr-8",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-xs font-medium text-muted-foreground", className)}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-[11px] text-subtle-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
