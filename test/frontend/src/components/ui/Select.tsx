import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef } from "react";

const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative flex-1">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none rounded-[var(--radius-sm)] border border-border bg-bg-elevated px-4 py-2.5 pr-10 text-sm text-text",
          "transition-all duration-200 cursor-pointer",
          "hover:border-border-hover focus:border-primary focus:ring-2 focus:ring-ring",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M6 8L1 3h10z" />
      </svg>
    </div>
  );
});
Select.displayName = "Select";
export { Select };
