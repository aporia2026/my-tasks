import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { UserProvider } from "@/components/user-provider";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <UserProvider>
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="brandmk" aria-hidden>
              M
            </span>
            <span className="text-base font-bold tracking-tight">My Tasks</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              Tasks
            </Link>
            <Link
              href="/settings"
              className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              Settings
            </Link>
            <a
              href="/api/export"
              className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              Export
            </a>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </UserProvider>
  );
}
