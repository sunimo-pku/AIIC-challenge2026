import { TopNav } from "./TopNav";

interface HeaderProps {
  icon: string;
  title: string;
  subtitle: string;
}

export function Header({ icon, title, subtitle }: HeaderProps) {
  return (
    <header className="flex flex-col items-center py-8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 text-3xl shadow-[0_0_24px_rgba(56,189,248,0.25)]">
        {icon}
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
