"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { log } from "@/lib/logger";
import { requesterStatusLabel } from "@/lib/review";
import {
  PRIORITY_LABELS,
  type TaskDto,
  type TaskPriority,
} from "@/lib/types";

const logger = log("ui requester");

const PILL_CLASS: Record<string, string> = {
  "Under review": "pill-amber",
  Declined: "pill-red",
  Done: "pill-green",
  "Working on it": "pill-accent",
  "In progress": "pill-accent",
  Accepted: "pill-accent",
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-stone-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

export function RequesterDashboard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/tasks");
    if (!response.ok) {
      setError("Could not load your tasks. Refresh to try again.");
      return;
    }
    const body = (await response.json()) as { tasks: TaskDto[] };
    setTasks(body.tasks);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; setState fires in the promise callback, not synchronously
    void load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;
    setSending(true);
    setError(null);
    logger.info("sending task");
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        notes: notes.trim() || undefined,
        priority,
      }),
    });
    setSending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Sending the task failed.");
      return;
    }
    // Go to the task so files can be added and progress followed.
    const body = (await response.json()) as { task: TaskDto };
    router.push(`/tasks/${body.task.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!composing ? (
        <button
          onClick={() => setComposing(true)}
          className="w-full rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white sm:w-auto"
        >
          Send a new task
        </button>
      ) : (
        <form
          onSubmit={send}
          className="rounded-2xl border border-line bg-surface p-5"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need?"
            className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any details that would help (optional)"
            rows={4}
            className="mt-3 w-full resize-y rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="rounded-lg border border-line bg-background px-2 py-1.5 text-xs text-foreground"
              >
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || title.trim().length === 0}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            You can attach files on the next screen.
          </p>
        </form>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {tasks === null && !error && (
        <p className="mt-10 text-center text-sm text-muted">Loading your tasks...</p>
      )}

      {tasks !== null && tasks.length === 0 && (
        <div className="mt-14 text-center">
          <p className="text-sm font-medium">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted">Send your first task above.</p>
        </div>
      )}

      {tasks !== null && tasks.length > 0 && (
        <ul className="mt-8 space-y-2">
          {tasks.map((task) => {
            const label = requesterStatusLabel(task);
            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      title={`${PRIORITY_LABELS[task.priority]} priority`}
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                    />
                    <span className="truncate text-sm font-medium">{task.title}</span>
                  </div>
                  <span className={`pill shrink-0 ${PILL_CLASS[label] ?? "pill-muted"}`}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
