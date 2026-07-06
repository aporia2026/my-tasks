import { AiStatusBadge } from "@/components/ai-status-badge";
import { PRIORITY_LABELS, type TaskDto, type TaskPriority } from "@/lib/types";

export type TaskDensity = "comfortable" | "compact";

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-stone-300",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

/**
 * Presentational task card, shared by the list and board views. It renders no
 * link or drag behavior of its own; the wrapper decides what a click does.
 */
export function TaskCard({
  task,
  density,
}: {
  task: TaskDto;
  density: TaskDensity;
}) {
  const compact = density === "compact";
  const fileCount = task.attachments?.length ?? 0;

  return (
    <div
      className={`rounded-2xl border border-line bg-surface transition-colors hover:border-accent ${
        compact ? "px-4 py-2.5" : "p-5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            title={`${PRIORITY_LABELS[task.priority]} priority`}
            className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`}
          />
          <h3 className="truncate text-sm font-semibold">{task.title}</h3>
        </div>
        <AiStatusBadge status={task.aiStatus} />
      </div>

      {!compact && (
        <>
          {task.tldr ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted">{task.tldr}</p>
          ) : (
            <p className="mt-2 text-sm italic text-muted">No summary yet.</p>
          )}
          {fileCount > 0 && (
            <p className="mt-3 text-xs text-muted">
              {fileCount} file{fileCount === 1 ? "" : "s"} attached
            </p>
          )}
        </>
      )}
    </div>
  );
}
