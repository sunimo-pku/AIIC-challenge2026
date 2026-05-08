import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-all duration-200 cursor-pointer",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none",
          "active:scale-[0.98] active:translate-y-px",
          {
            "bg-primary text-[#0a0e17] shadow-[0_0_16px_rgba(56,189,248,0.25)] hover:shadow-[0_0_24px_rgba(56,189,248,0.35)] hover:brightness-110":
              variant === "primary",
            "bg-bg-elevated text-text border border-border hover:border-border-hover hover:bg-bg-secondary":
              variant === "secondary",
            "bg-transparent text-text-secondary hover:text-text hover:bg-bg-secondary":
              variant === "ghost",
            "bg-error/10 text-error border border-error/20 hover:bg-error/20":
              variant === "danger",
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2.5 text-sm": size === "md",
            "px-6 py-3 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export { Button };
