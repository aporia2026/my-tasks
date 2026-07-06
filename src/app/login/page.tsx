"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { log } from "@/lib/logger";

const logger = log("ui login");

type Mode = "password" | "link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // A bounced sign-in link redirects back here with ?error=link. Reading the
    // URL must happen after mount, so the server render and first client render
    // match and hydration stays clean.
    if (new URLSearchParams(window.location.search).get("error") === "link") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a URL param post-mount, not a render-loop trigger
      setError("That link did not work. It may have expired or been used already.");
    }
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    if (mode === "link") {
      logger.info("requesting sign-in link");
      const response = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setBusy(false);
      if (response.ok) {
        setSent(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Something went wrong. Try again.");
      return;
    }

    logger.info("submitting password", { email });
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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

  if (sent) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            If that email has access, a sign-in link is on its way. It works once
            and expires in 15 minutes.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setError(null);
            }}
            className="mt-6 text-sm text-accent underline"
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold">My Tasks</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "password"
            ? "Sign in to open your dashboard."
            : "We will email you a link to sign in."}
        </p>

        <input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-6 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
        />

        {mode === "password" && (
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-3 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || email.length === 0 || (mode === "password" && password.length === 0)}
          className="mt-4 w-full rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {busy
            ? "Working..."
            : mode === "password"
              ? "Sign in"
              : "Email me a link"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "password" ? "link" : "password");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-muted hover:text-foreground"
        >
          {mode === "password"
            ? "Email me a sign-in link instead"
            : "Use a password instead"}
        </button>
      </form>
    </main>
  );
}
