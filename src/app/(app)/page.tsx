"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AiStatusBadge } from "@/components/ai-status-badge";
import { log } from "@/lib/logger";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskDto,
  type TaskStatus,
} from "@/lib/types";

const logger = log("ui dashboard");

type Filter = "all" | TaskStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "inbox", label: "Inbox" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-stone-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/tasks");
    if (!response.ok) {
      setError("Could not load tasks. Refresh to try again.");
      return;
    }
    const body = (await response.json()) as { tasks: TaskDto[] };
    logger.info("tasks loaded", { count: body.tasks.length });
    setTasks(body.tasks);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; setState fires in the promise callback, not synchronously
    void load();
  }, [load]);

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;
    setCreating(true);
    setError(null);
    logger.info("creating task", { title });
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setCreating(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Creating the task failed.");
      return;
    }
    setTitle("");
    await load();
  }

  const visible =
    tasks?.filter((t) => filter === "all" || t.status === filter) ?? [];

  return (
    <div>
      <form onSubmit={createTask} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What landed on your plate?"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating || title.trim().length === 0}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {creating ? "Adding..." : "Add task"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-foreground text-background"
                : "bg-surface text-muted border border-line hover:text-foreground"
            }`}
          >
            {f.label}
            {tasks && f.value !== "all" && (
              <span className="ml-1 opacity-60">
                {tasks.filter((t) => t.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {tasks === null && !error && (
        <p className="mt-10 text-center text-sm text-muted">Loading tasks...</p>
      )}

      {tasks !== null && visible.length === 0 && (
        <div className="mt-14 text-center">
          <p className="text-sm font-medium">
            {filter === "all" ? "No tasks yet." : `Nothing in ${TASK_STATUS_LABELS[filter as TaskStatus]}.`}
          </p>
          <p className="mt-1 text-sm text-muted">
            Add a task above, then drop a meeting recording or screenshot on it.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {visible.map((task) => (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      title={`${PRIORITY_LABELS[task.priority]} priority`}
                      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
                    />
                    <h2 className="truncate text-sm font-semibold">{task.title}</h2>
                  </div>
                  {task.tldr ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{task.tldr}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted italic">
                      No summary yet.
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                    {TASK_STATUS_LABELS[task.status]}
                  </span>
                  <AiStatusBadge status={task.aiStatus} />
                </div>
              </div>
              {(task.attachments?.length ?? 0) > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {task.attachments!.length} file
                  {task.attachments!.length === 1 ? "" : "s"} attached
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
