import { TopNav } from "./TopNav";
import { type LucideIcon } from "lucide-react";

interface HeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

export function Header({ icon: Icon, title, subtitle }: HeaderProps) {
  return (
    <header className="flex flex-col items-center py-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={28} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      <div className="mt-5">
        <TopNav />
      </div>
    </header>
  );
}
