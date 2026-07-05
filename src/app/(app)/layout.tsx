import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            My Tasks
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
    </>
  );
}
