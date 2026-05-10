import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-out cursor-pointer",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          "active:scale-[0.98]",
          {
            "bg-accent text-white hover:bg-accent-strong shadow-sm hover:shadow": variant === "solid",
            "border border-border text-fg hover:bg-accent-soft hover:text-accent hover:border-accent/30": variant === "outline",
            "bg-transparent text-fg-muted hover:text-fg hover:bg-elevated": variant === "ghost",
            "border border-error/20 text-error hover:bg-error/10": variant === "danger",
            "px-3 py-1.5 text-[13px]": size === "sm",
            "px-4 py-2 text-[14px]": size === "md",
            "px-6 py-2.5 text-[15px]": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
