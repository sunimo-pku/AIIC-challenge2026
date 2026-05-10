import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-border/50 bg-elevated shadow-sm transition-all duration-200",
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "h-12 px-5 flex items-center justify-between border-b border-border/40 text-[13px] font-semibold tracking-wide text-fg",
          className
        )}
        {...props}
      />
    );
  }
);
CardHeader.displayName = "CardHeader";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("px-5 py-5", className)} {...props} />;
  }
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardContent };
