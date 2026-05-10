import { cn } from "@/lib/utils";

interface StatusCardProps {
  label: string;
  value: string;
  unit?: string;
  className?: string;
}

export function StatusCard({ label, value, unit, className }: StatusCardProps) {
  return (
    <div className={cn("rounded-xl border border-border/50 bg-elevated shadow-sm overflow-hidden transition-all duration-200", className)}>
      <div className="h-10 px-4 flex items-center border-b border-border/40 text-[12px] text-fg-subtle">
        <span className="font-semibold tracking-wide">{label}</span>
      </div>
      <div className="px-4 py-4">
        <div className="font-mono text-[22px] leading-tight text-fg tracking-wide font-medium">
          {value}
        </div>
        {unit && (
          <div className="mt-1.5 text-[12px] text-fg-subtle">
            {unit}
          </div>
        )}
      </div>
    </div>
  );
}
