"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardToolbar, type ViewMode } from "@/components/dashboard-toolbar";
import { TaskBoardView } from "@/components/task-board-view";
import type { TaskDensity } from "@/components/task-card";
import { TaskListView } from "@/components/task-list-view";
import { log } from "@/lib/logger";
import { filterTasks, groupTasksByStatus } from "@/lib/tasks-view";
import { type TaskDto, type TaskStatus } from "@/lib/types";

const logger = log("ui dashboard");

export default function DashboardPage() {
  const [tasks, setTasks] = useState<TaskDto[] | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [density, setDensity] = useState<TaskDensity>("comfortable");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(
    () => new Set<TaskStatus>(["done"]),
  );
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
    logger.info("view changed", { view: next });
    persistSetting({ defaultView: next });
  }

  function changeDensity(next: TaskDensity) {
    setDensity(next);
    logger.info("density changed", { density: next });
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

  const changeStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      setError(null);
      const previous = tasks;
      logger.info("status changed", { taskId, status });
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

  const groups = useMemo(
    () => groupTasksByStatus(filterTasks(tasks ?? [], search)),
    [tasks, search],
  );
  const totalTasks = tasks?.length ?? 0;
  const hasVisible = groups.some((group) => group.tasks.length > 0);
  // While searching, reveal every group so matches are never hidden behind a
  // collapsed header.
  const effectiveCollapsed = search.trim() ? new Set<TaskStatus>() : collapsed;

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

      {totalTasks > 0 && (
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

      {tasks !== null && totalTasks === 0 && (
        <div className="mt-14 text-center">
          <p className="text-sm font-medium">No tasks yet.</p>
          <p className="mt-1 text-sm text-muted">
            Add a task above, then drop a meeting recording or screenshot on it.
          </p>
        </div>
      )}

      {tasks !== null && totalTasks > 0 && !hasVisible && (
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
