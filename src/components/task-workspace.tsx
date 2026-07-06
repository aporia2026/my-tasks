"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";
import { CommentThread } from "@/components/comment-thread";
import { TodoChecklist } from "@/components/todo-checklist";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useUser } from "@/components/user-provider";
import { runProcessing } from "@/lib/client/upload";
import { log } from "@/lib/logger";
import { canProcess, requesterStatusLabel } from "@/lib/review";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const logger = log("ui task");

const POLL_INTERVAL_MS = 3000;

/** ISO timestamp -> yyyy-mm-dd for a date input (empty when unset). */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * The full task detail surface, shared by the /tasks/[id] page and the board
 * modal. `taskId` selects the task; `initialTask` (the row the board already
 * has) paints instantly before the full detail fetch lands. `onClose` renders
 * modal-aware controls, and `onChanged` lets a parent list refresh after edits.
 */
export function TaskWorkspace({
  taskId,
  initialTask,
  onClose,
  onChanged,
}: {
  taskId: string;
  initialTask?: TaskDto;
  onClose?: () => void;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [task, setTask] = useState<TaskDto | null>(initialTask ?? null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [autoProcess, setAutoProcess] = useState(true);
  const processingRef = useRef(false);
  const rerunRef = useRef(false);

  // Editable field state for the admin (initialized from the task).
  const [fTitle, setFTitle] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fDue, setFDue] = useState("");
  const [fTldr, setFTldr] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    const response = await fetch(`/api/tasks/${taskId}`);
    if (response.status === 404) {
      setNotFound(true);
      return;
    }
    if (!response.ok) {
      setError("Could not load this task. Refresh to try again.");
      return;
    }
    const body = (await response.json()) as { task: TaskDto };
    setTask(body.task);
  }, [taskId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch; setState fires in the promise callback, not synchronously
    void load();
    void fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { settings?: { autoProcessOnUpload?: boolean } } | null) => {
        if (body?.settings?.autoProcessOnUpload !== undefined) {
          setAutoProcess(body.settings.autoProcessOnUpload);
        }
      });
  }, [load]);

  // Re-sync the editable fields whenever the task changes (load, save, or a
  // finished AI run that filled the summary).
  useEffect(() => {
    if (!task) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local form to loaded data, not a render loop
    setFTitle(task.title);
    setFNotes(task.notes ?? "");
    setFDue(toDateInput(task.dueDate));
    setFTldr(task.tldr ?? "");
    setFDesc(task.description ?? "");
  }, [task?.updatedAt, task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while the pipeline is running so progress stays live.
  useEffect(() => {
    const busy =
      processing ||
      task?.aiStatus === "processing" ||
      task?.attachments?.some((a) => a.status === "transcribing");
    if (!busy) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [processing, task, load]);

  const startProcessing = useCallback(async () => {
    if (processingRef.current) {
      rerunRef.current = true;
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    setError(null);
    logger.info("processing requested", { taskId });
    try {
      do {
        rerunRef.current = false;
        await runProcessing(taskId);
      } while (rerunRef.current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      processingRef.current = false;
      rerunRef.current = false;
      setProcessing(false);
      void load();
    }
  }, [taskId, load]);

  const updateTask = useCallback(
    async (patch: Record<string, unknown>) => {
      logger.info("updating task", { taskId, fields: Object.keys(patch) });
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) setError("Saving the change failed.");
      await load();
      onChanged?.();
    },
    [taskId, load, onChanged],
  );

  /** Persists the editable text fields. Returns false if the title is empty. */
  const saveFields = useCallback(async () => {
    if (fTitle.trim().length === 0) {
      setError("A title is required.");
      return false;
    }
    setSaving(true);
    setError(null);
    await updateTask({
      title: fTitle.trim(),
      notes: fNotes.trim() || null,
      dueDate: fDue ? new Date(fDue).toISOString() : null,
      description: fDesc,
      tldr: fTldr,
    });
    setSaving(false);
    return true;
  }, [fTitle, fNotes, fDue, fDesc, fTldr, updateTask]);

  async function generateWithAi() {
    // Persist typed details first so the AI summarizes the latest content.
    if (!(await saveFields())) return;
    await startProcessing();
  }

  async function review(action: "approve" | "decline") {
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
      setError("That review action failed.");
      return;
    }
    await load();
    onChanged?.();
  }

  /** Marks the AI summary reviewed and cleans up audio per the retention setting. */
  async function confirmSummary() {
    setConfirming(true);
    const response = await fetch(`/api/tasks/${taskId}/confirm`, { method: "POST" });
    setConfirming(false);
    if (!response.ok) {
      setError("Could not confirm this summary.");
      return;
    }
    await load();
    onChanged?.();
  }

  async function postComment(commentBody: string): Promise<boolean> {
    const response = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    });
    if (!response.ok) {
      setError("Could not post your comment.");
      return false;
    }
    await load();
    return true;
  }

  async function deleteTask() {
    if (!task) return;
    if (
      !window.confirm(
        `Delete "${task.title}" with its files and transcripts? This cannot be undone.`,
      )
    ) {
      return;
    }
    logger.info("deleting task", { taskId });
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Deleting the task failed.");
      return;
    }
    // In the modal, hand control back to the board; on the page, navigate home.
    onChanged?.();
    if (onClose) onClose();
    else router.push("/");
  }

  if (notFound) {
    return (
      <div className="text-center">
        <p className="text-sm font-medium">This task no longer exists.</p>
        {onClose ? (
          <button
            onClick={onClose}
            className="mt-2 inline-block text-sm text-accent underline"
          >
            Close
          </button>
        ) : (
          <Link href="/" className="mt-2 inline-block text-sm text-accent underline">
            Back to all tasks
          </Link>
        )}
      </div>
    );
  }

  if (!task || !user) {
    return <p className="text-center text-sm text-muted">Loading task...</p>;
  }

  // The back link only makes sense on the standalone page; the modal has its own
  // close control in the chrome around this component.
  const backLink = onClose ? null : (
    <Link href="/" className="text-xs text-muted hover:text-foreground">
      &larr; All tasks
    </Link>
  );

  // Requester view: their own task, no pipeline mechanics, plain status.
  if (!isAdmin) {
    const label = requesterStatusLabel(task);
    return (
      <div className="space-y-8">
        <div>
          {backLink}
          <h1 className={`text-xl font-semibold ${backLink ? "mt-2" : ""}`}>
            {task.title}
          </h1>
          <p className="mt-2 text-sm text-muted">Status: {label}</p>
          {task.reviewState === "declined" && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This task was declined.
              {task.declineReason ? ` Reason: ${task.declineReason}` : ""}
            </p>
          )}
          {task.notes && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{task.notes}</p>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold">Files</h2>
          <UploadDropzone taskId={task.id} onUploaded={() => void load()} />
          {(task.attachments?.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {task.attachments!.map((a) => (
                <li key={a.id}>{a.originalName}</li>
              ))}
            </ul>
          )}
        </section>

        {(task.tldr || task.description) && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Summary</h2>
            {task.tldr && (
              <div className="rounded-2xl border border-accent bg-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  What you need to do
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {task.tldr}
                </p>
              </div>
            )}
            {task.description && (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Full picture
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}
          </section>
        )}

        <TodoChecklist
          taskId={task.id}
          todos={task.todos ?? []}
          editable={false}
          canRegenerate={false}
          onChanged={load}
        />

        <CommentThread
          comments={task.comments ?? []}
          currentUserId={user.id}
          onPost={postComment}
        />
      </div>
    );
  }

  // Admin view: fully editable fields, plus the AI pipeline and review controls.
  const from =
    task.owner && task.owner.role !== "admin"
      ? (task.owner.name ?? task.owner.email)
      : null;
  const hasFiles = (task.attachments?.length ?? 0) > 0;
  const canGenerate = fNotes.trim().length > 0 || hasFiles;
  const fieldsDirty =
    fTitle !== task.title ||
    fNotes !== (task.notes ?? "") ||
    fDue !== toDateInput(task.dueDate) ||
    fTldr !== (task.tldr ?? "") ||
    fDesc !== (task.description ?? "");

  const fieldClass =
    "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm outline-none focus:border-accent";

  return (
    <div className="space-y-8">
      <div>
        {backLink}
        <div
          className={`flex flex-wrap items-start justify-between gap-3 ${
            backLink ? "mt-2" : "pr-10"
          }`}
        >
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{task.title}</h1>
            {from && <p className="mt-1 text-xs text-muted">from {from}</p>}
          </div>
          <button
            onClick={deleteTask}
            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-red-600"
          >
            Delete task
          </button>
        </div>

        {task.reviewState === "pending" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-sm text-amber-800">This task is awaiting your review.</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => void review("approve")} className="btn btn-primary btn-sm">
                Approve
              </button>
              <button
                onClick={() => void review("decline")}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-red-600"
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Editable task fields */}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <label className="text-xs font-medium text-muted">Title</label>
          <input
            value={fTitle}
            onChange={(e) => setFTitle(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted">
            Status
            <select
              value={task.status}
              onChange={(e) => void updateTask({ status: e.target.value })}
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
            Priority
            <select
              value={task.priority}
              onChange={(e) => void updateTask({ priority: e.target.value })}
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
            Due date
            <input
              type="date"
              value={fDue}
              onChange={(e) => setFDue(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <div>
          <label className="text-xs font-medium text-muted">Details</label>
          <textarea
            value={fNotes}
            onChange={(e) => setFNotes(e.target.value)}
            rows={4}
            placeholder="Context, links, what needs doing..."
            className={`mt-1 resize-y ${fieldClass}`}
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={() => void saveFields()}
            disabled={saving || !fieldsDirty}
            className="btn btn-primary btn-sm"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {/* Files */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Files</h2>
        <UploadDropzone
          taskId={task.id}
          onUploaded={() => (autoProcess ? void startProcessing() : void load())}
        />
        <div className="mt-3">
          <AttachmentList
            attachments={task.attachments ?? []}
            onChanged={() => void load()}
          />
        </div>
      </section>

      {/* AI summary: editable, with a Generate button */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Summary</h2>
          <button
            onClick={() => void generateWithAi()}
            disabled={processing || !canGenerate}
            className="btn btn-primary btn-sm"
            title={canGenerate ? undefined : "Add details or a file first"}
          >
            {processing ? "Generating..." : "Generate with AI"}
          </button>
        </div>

        {processing && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-800">
              Working on it. Transcription runs in the background; you can leave
              this page and come back.
            </p>
          </div>
        )}

        {task.aiStatus === "failed" && task.aiError && !processing && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4">
            <p className="text-sm font-medium text-red-700">{task.aiError}</p>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-accent">
            What you need to do (TLDR)
          </label>
          <textarea
            value={fTldr}
            onChange={(e) => setFTldr(e.target.value)}
            rows={4}
            placeholder="Write it yourself, or generate it with AI."
            className={`mt-1 resize-y ${fieldClass}`}
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">
            Full description
          </label>
          <textarea
            value={fDesc}
            onChange={(e) => setFDesc(e.target.value)}
            rows={6}
            placeholder="The full picture of what this task involves."
            className={`mt-1 resize-y ${fieldClass}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {task.aiStatus === "ready" && !processing && (
              <button
                onClick={() => void confirmSummary()}
                disabled={confirming}
                className="btn btn-ghost btn-sm"
                title="Marks the summary reviewed and cleans up audio files per your Settings"
              >
                {confirming ? "Confirming..." : "Confirm & clean up audio"}
              </button>
            )}
          </div>
          <button
            onClick={() => void saveFields()}
            disabled={saving || !fieldsDirty}
            className="btn btn-primary btn-sm"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </section>

      {/* Sub-tasks: the admin's working checklist */}
      <TodoChecklist
        taskId={task.id}
        todos={task.todos ?? []}
        editable
        canRegenerate={canProcess(task.reviewState)}
        onChanged={load}
      />

      <CommentThread
        comments={task.comments ?? []}
        currentUserId={user.id}
        onPost={postComment}
      />
    </div>
  );
}
