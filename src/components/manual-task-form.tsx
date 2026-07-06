"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { UploadDropzone } from "@/components/upload-dropzone";
import { log } from "@/lib/logger";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const logger = log("ui manual task");

const fieldClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent";

/**
 * Full "New task" form: every field, an AI draft for the TLDR/description, and
 * an inline file dropzone that appears once the task exists (uploads attach to
 * the new task's id).
 */
export function ManualTaskForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("inbox");
  const [due, setDue] = useState("");
  const [details, setDetails] = useState("");
  const [description, setDescription] = useState("");
  const [tldr, setTldr] = useState("");
  const [todoList, setTodoList] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  async function generate() {
    setGenerating(true);
    setError(null);
    logger.info("drafting summary");
    const response = await fetch("/api/ai/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), details: details.trim() }),
    });
    setGenerating(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Could not generate a draft.");
      return;
    }
    const body = (await response.json()) as {
      description: string;
      tldr: string;
      todos?: string[];
    };
    setDescription(body.description);
    setTldr(body.tldr);
    if (body.todos?.length) setTodoList(body.todos);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length === 0) return;
    setCreating(true);
    setError(null);
    const cleanTodos = todoList.map((t) => t.trim()).filter(Boolean);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        priority,
        status,
        notes: details.trim() || undefined,
        description: description || undefined,
        tldr: tldr || undefined,
        dueDate: due ? new Date(due).toISOString() : undefined,
        todos: cleanTodos.length ? cleanTodos : undefined,
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
    // Keep the user here and reveal the dropzone (uploads need the new id).
    const body = (await response.json()) as { task: TaskDto };
    setCreatedId(body.task.id);
  }

  // Step 2: task exists, attach files inline.
  if (createdId) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm font-medium">Task created. Attach files if you have any.</p>
        <UploadDropzone
          taskId={createdId}
          onUploaded={() => setFileCount((c) => c + 1)}
        />
        {fileCount > 0 && (
          <p className="text-xs text-muted">
            {fileCount} file{fileCount === 1 ? "" : "s"} added.
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCreated}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => router.push(`/tasks/${createdId}`)}
            className="btn btn-primary btn-sm"
          >
            Open task
          </button>
        </div>
      </div>
    );
  }

  const canGenerate =
    title.trim().length > 0 && details.trim().length > 0 && !generating;

  return (
    <form
      onSubmit={create}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div>
        <label className="text-xs font-medium text-muted">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={`mt-1 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted">
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={`mt-1 ${fieldClass}`}
          >
            {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            className={`mt-1 ${fieldClass}`}
          >
            {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Due date
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Details</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          placeholder="Context, links, what needs doing..."
          className={`mt-1 resize-y ${fieldClass}`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-accent">
            What you need to do (TLDR)
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate}
            title={canGenerate ? undefined : "Add a title and details first"}
            className="btn btn-ghost btn-sm"
          >
            {generating ? "Generating..." : "Generate with AI"}
          </button>
        </div>
        <textarea
          value={tldr}
          onChange={(e) => setTldr(e.target.value)}
          rows={3}
          placeholder="Write it yourself, or generate it from the details above."
          className={`mt-1 resize-y ${fieldClass}`}
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted">
          Sub-tasks
        </label>
        <div className="mt-1 space-y-2">
          {todoList.map((todo, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={todo}
                onChange={(e) =>
                  setTodoList((cur) =>
                    cur.map((t, j) => (j === i ? e.target.value : t)),
                  )
                }
                onKeyDown={(e) => {
                  // Enter adds the next sub-task instead of submitting the form.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (todo.trim()) setTodoList((cur) => [...cur, ""]);
                  }
                }}
                placeholder={`Sub-task ${i + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setTodoList((cur) => cur.filter((_, j) => j !== i))}
                aria-label="Remove sub-task"
                className="shrink-0 px-2 leading-none text-faint hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTodoList((cur) => [...cur, ""])}
            className="btn btn-ghost btn-sm"
          >
            Add sub-task
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted">
          Full description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="The full picture (optional)."
          className={`mt-1 resize-y ${fieldClass}`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={creating || title.trim().length === 0}
          className="btn btn-primary btn-sm"
        >
          {creating ? "Creating..." : "Create task"}
        </button>
      </div>
    </form>
  );
}
