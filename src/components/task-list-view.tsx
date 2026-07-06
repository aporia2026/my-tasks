"use client";

import Link from "next/link";

import { TaskCard, type TaskDensity } from "@/components/task-card";
import type { TaskGroup } from "@/lib/tasks-view";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

/**
 * Grouped, collapsible list. Empty groups are hidden entirely; the parent
 * shows the overall empty state when nothing is visible.
 */
export function TaskListView({
  groups,
  density,
  collapsed,
  onToggle,
}: {
  groups: TaskGroup[];
  density: TaskDensity;
  collapsed: Set<TaskStatus>;
  onToggle: (status: TaskStatus) => void;
}) {
  const visible = groups.filter((group) => group.tasks.length > 0);

  return (
    <div className="space-y-6">
      {visible.map((group) => {
        const isCollapsed = collapsed.has(group.status);
        return (
          <section key={group.status}>
            <button
              onClick={() => onToggle(group.status)}
              className="flex w-full items-center gap-2 py-1 text-left"
              aria-expanded={!isCollapsed}
            >
              <svg
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={`h-3.5 w-3.5 text-muted transition-transform ${
                  isCollapsed ? "" : "rotate-90"
                }`}
              >
                <path
                  d="M4 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {TASK_STATUS_LABELS[group.status]}
              </h2>
              <span className="text-xs text-muted">{group.tasks.length}</span>
            </button>

            {!isCollapsed && (
              <ul
                className={`mt-3 ${density === "compact" ? "space-y-1.5" : "space-y-3"}`}
              >
                {group.tasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="block">
                      <TaskCard task={task} density={density} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
