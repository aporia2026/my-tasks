"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardToolbar, type ViewMode } from "@/components/dashboard-toolbar";
import { TaskBoardView } from "@/components/task-board-view";
import type { TaskDensity } from "@/components/task-card";
import { TaskListView } from "@/components/task-list-view";
import { log } from "@/lib/logger";
import { filterTasks, groupTasksByStatus } from "@/lib/tasks-view";
import {
  PRIORITY_LABELS,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const logger = log("ui dashboard");

/** Tasks still in the review queue are held out of the normal status groups. */
function isActive(task: TaskDto): boolean {
  return task.reviewState === "none" || task.reviewState === "accepted";
}

export function AdminDashboard() {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [density, setDensity] = useState<TaskDensity>("comfortable");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(
    () => new Set<TaskStatus>(["done"]),
  );
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [showDetails, setShowDetails] = useState(false);
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
    void fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          body: {
            settings?: { defaultView?: ViewMode; taskDensity?: TaskDensity };
          } | null,
        ) => {
          if (body?.settings?.defaultView) setView(body.settings.defaultView);
          if (body?.settings?.taskDensity) setDensity(body.settings.taskDensity);
        },
      );
  }, [load]);

  function persistSetting(patch: Record<string, unknown>) {
    void fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  function changeView(next: ViewMode) {
    setView(next);
    persistSetting({ defaultView: next });
  }

  function changeDensity(next: TaskDensity) {
    setDensity(next);
    persistSetting({ taskDensity: next });
  }

  function toggleCollapse(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;
    setCreating(true);
    setError(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        notes: notes.trim() || undefined,
        dueDate: due ? new Date(due).toISOString() : undefined,
      }),
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
    setPriority("medium");
    setNotes("");
    setDue("");
    setShowDetails(false);
    await load();
  }

  const changeStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      setError(null);
      const previous = tasks;
      setTasks(
        (current) =>
          current?.map((t) => (t.id === taskId ? { ...t, status } : t)) ?? current,
      );
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setError("Could not move that task. Putting it back.");
        setTasks(previous ?? null);
      }
    },
    [tasks],
  );

  async function review(taskId: string, action: "approve" | "decline") {
    setError(null);
    let reason: string | null = null;
    if (action === "decline") {
      reason = window.prompt("Reason for declining (optional):") ?? null;
    }
    const response = await fetch(`/api/tasks/${taskId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "decline" ? JSON.stringify({ reason }) : undefined,
    });
    if (!response.ok) {
      setError("That review action failed. Refresh and try again.");
      return;
    }
    logger.info("task reviewed", { taskId, action });
    await load();
  }

  const pending = useMemo(
    () => (tasks ?? []).filter((t) => t.reviewState === "pending"),
    [tasks],
  );
  const groups = useMemo(
    () => groupTasksByStatus(filterTasks((tasks ?? []).filter(isActive), search)),
    [tasks, search],
  );
  const totalActive = (tasks ?? []).filter(isActive).length;
  const hasVisible = groups.some((group) => group.tasks.length > 0);
  const effectiveCollapsed = search.trim() ? new Set<TaskStatus>() : collapsed;

  return (
    <div>
      <form onSubmit={createTask} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What landed on your plate?"
            className="flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            aria-label="Priority"
            className="rounded-xl border border-line bg-surface px-3 py-3 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || title.trim().length === 0}
            className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {creating ? "Adding..." : "Add task"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-xs text-muted hover:text-foreground"
        >
          {showDetails ? "Hide details" : "+ Add details"}
        </button>

        {showDetails && (
          <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Details (optional). If you generate a TLDR later, the AI uses this."
              className="w-full resize-y rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              Due date
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="rounded-lg border border-line bg-background px-2 py-1.5 text-xs text-foreground"
              />
            </label>
          </div>
        )}
      </form>

      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow">Needs review ({pending.length})</h2>
          <div className="mt-2 space-y-2">
            {pending.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <Link href={`/tasks/${task.id}`} className="text-sm font-medium hover:underline">
                    {task.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    from {task.owner?.name ?? task.owner?.email ?? "someone"}
                    {(task.attachments?.length ?? 0) > 0 &&
                      ` · ${task.attachments!.length} file${task.attachments!.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void review(task.id, "approve")}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void review(task.id, "decline")}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-red-600"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalActive > 0 && (
        <div className="mt-6">
          <DashboardToolbar
            view={view}
            density={density}
            search={search}
            onView={changeView}
            onDensity={changeDensity}
            onSearch={setSearch}
          />
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {tasks === null && !error && (
        <p className="mt-10 text-center text-sm text-muted">Loading tasks...</p>
      )}

      {tasks !== null && totalActive === 0 && pending.length === 0 && (
        <div className="mt-14 text-center">
          <p className="text-sm font-medium">No tasks yet.</p>
          <p className="mt-1 text-sm text-muted">
            Add a task above, or wait for someone to send one your way.
          </p>
        </div>
      )}

      {tasks !== null && totalActive > 0 && !hasVisible && (
        <p className="mt-10 text-center text-sm text-muted">
          No tasks match &ldquo;{search}&rdquo;.
        </p>
      )}

      {tasks !== null && hasVisible && (
        <div className="mt-6">
          {view === "list" ? (
            <TaskListView
              groups={groups}
              density={density}
              collapsed={effectiveCollapsed}
              onToggle={toggleCollapse}
            />
          ) : (
            <TaskBoardView
              groups={groups}
              density={density}
              onStatusChange={changeStatus}
            />
          )}
        </div>
      )}
    </div>
  );
}
