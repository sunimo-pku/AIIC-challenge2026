import { ThemeToggle } from "@/components/ThemeToggle";

interface TopBarProps {
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function TopBar({ center, right }: TopBarProps) {
  return (
    <header className="h-11 shrink-0 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-bg z-10">
      <div className="flex items-center gap-4 lg:gap-6">
        <a
          href="/"
          className="font-display text-[13px] tracking-[0.08em] text-fg hover:text-accent transition-colors duration-150"
        >
          MOCKMATE
        </a>
      </div>

      {center && (
        <div className="hidden lg:flex items-center text-[12px] text-fg-subtle">
          {center}
        </div>
      )}

      <div className="flex items-center gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
