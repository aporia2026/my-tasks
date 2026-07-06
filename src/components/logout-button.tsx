"use client";

import { useRouter } from "next/navigation";

import { log } from "@/lib/logger";

const logger = log("ui logout");

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    logger.info("logging out");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      Sign out
    </button>
  );
}
