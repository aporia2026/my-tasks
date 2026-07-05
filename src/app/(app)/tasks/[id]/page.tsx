"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";
import { SummaryPanel } from "@/components/summary-panel";
import { UploadDropzone } from "@/components/upload-dropzone";
import { runProcessing } from "@/lib/client/upload";
import { log } from "@/lib/logger";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/types";

const logger = log("ui task");

const POLL_INTERVAL_MS = 3000;

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<TaskDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [autoProcess, setAutoProcess] = useState(true);
  const processingRef = useRef(false);
  const rerunRef = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/tasks/${id}`);
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
  }, [id]);

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

  // Poll while the pipeline is running so segment progress stays live.
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
    // A request that arrives mid-run (e.g. a second file finishing upload)
    // queues one follow-up run so its segments are not left behind.
    if (processingRef.current) {
      rerunRef.current = true;
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    setError(null);
    logger.info("processing requested", { taskId: id });
    try {
      do {
        rerunRef.current = false;
        await runProcessing(id);
      } while (rerunRef.current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      processingRef.current = false;
      rerunRef.current = false;
      setProcessing(false);
      void load();
    }
  }, [id, load]);

  async function updateTask(patch: Record<string, unknown>) {
    logger.info("updating task", { taskId: id, fields: Object.keys(patch) });
    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) setError("Saving the change failed.");
    await load();
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
    logger.info("deleting task", { taskId: id });
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (response.ok) router.push("/");
    else setError("Deleting the task failed.");
  }

  if (notFound) {
    return (
      <div className="text-center">
        <p className="text-sm font-medium">This task no longer exists.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-accent underline">
          Back to all tasks
        </Link>
      </div>
    );
  }

  if (!task) {
    return <p className="text-center text-sm text-muted">Loading task...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-foreground">
          &larr; All tasks
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{task.title}</h1>
          <button
            onClick={deleteTask}
            className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-red-600"
          >
            Delete task
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            Status
            <select
              value={task.status}
              onChange={(e) => void updateTask({ status: e.target.value })}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-foreground"
            >
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Priority
            <select
              value={task.priority}
              onChange={(e) => void updateTask({ priority: e.target.value })}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-foreground"
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Files</h2>
        <UploadDropzone
          taskId={task.id}
          onUploaded={() =>
            autoProcess ? void startProcessing() : void load()
          }
        />
        <div className="mt-3">
          <AttachmentList
            attachments={task.attachments ?? []}
            onChanged={() => void load()}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">AI summary</h2>
        <SummaryPanel
          task={task}
          processing={processing || task.aiStatus === "processing"}
          onGenerate={() => void startProcessing()}
          onChanged={() => void load()}
        />
      </section>
    </div>
  );
}
