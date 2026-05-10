import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

interface ModuleCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  meta?: string;
  status?: React.ReactNode;
  action?: React.ReactNode;
}

const ModuleCard = forwardRef<HTMLDivElement, ModuleCardProps>(
  ({ className, label, meta, status, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-border/50 bg-elevated shadow-sm flex flex-col overflow-hidden transition-all duration-200",
          className
        )}
        {...props}
      >
        {/* 标签条 */}
        <div className="h-12 px-5 flex items-center justify-between border-b border-border/40 text-[13px] text-fg-subtle shrink-0">
          <span className="font-semibold tracking-wide text-fg">{label}</span>
          {meta && <span className="font-medium">{meta}</span>}
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>

        {/* 分隔线 + 状态条 */}
        {(status || action) && (
          <>
            <div className="border-t border-border/40" />
            <div className="h-10 px-5 flex items-center justify-between text-[12px] text-fg-subtle shrink-0 bg-bg/30">
              <span>{status}</span>
              <span>{action}</span>
            </div>
          </>
        )}
      </div>
    );
  }
);
ModuleCard.displayName = "ModuleCard";
export { ModuleCard };
