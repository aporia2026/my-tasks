"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { log } from "@/lib/logger";

const logger = log("ui login");

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    logger.info("submitting passcode", { length: passcode.length });
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (response.ok) {
      router.push("/");
      router.refresh();
      return;
    }
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    setError(body?.error ?? "Something went wrong. Try again.");
    setBusy(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold">My Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your passcode to open the dashboard.
        </p>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="mt-6 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || passcode.length === 0}
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {busy ? "Checking..." : "Unlock"}
        </button>
      </form>
    </main>
  );
}
