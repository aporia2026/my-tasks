"use client";

import { useState } from "react";

import { log } from "@/lib/logger";
import type { TaskDto } from "@/lib/types";

const logger = log("ui summary");

export function SummaryPanel({
  task,
  processing,
  onGenerate,
  onChanged,
}: {
  task: TaskDto;
  processing: boolean;
  onGenerate: () => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const hasFiles = (task.attachments?.length ?? 0) > 0;
  const hasMaterial = hasFiles || Boolean(task.notes);

  async function confirm() {
    setConfirming(true);
    logger.info("confirming summary", { taskId: task.id });
    const response = await fetch(`/api/tasks/${task.id}/confirm`, {
      method: "POST",
    });
    setConfirming(false);
    if (response.ok) {
      const body = (await response.json()) as { mediaCleaned: number };
      logger.info("summary confirmed", {
        taskId: task.id,
        mediaCleaned: body.mediaCleaned,
      });
    }
    onChanged();
  }

  if (task.aiStatus === "idle" && !task.tldr) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          {hasMaterial
            ? "Ready when you are."
            : "Attach a recording, screenshot, or document first."}
        </p>
        {hasMaterial && (
          <button
            onClick={onGenerate}
            disabled={processing}
            className="mt-3 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Generate description and TLDR
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          <button
            onClick={onGenerate}
            className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      {task.tldr && (
        <div className="rounded-2xl border-2 border-accent bg-accent-soft/40 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">
              What you need to do
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {task.tldr}
          </p>
        </div>
      )}

      {task.description && (
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Full picture
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {task.description}
          </p>
        </div>
      )}

      {task.aiStatus === "ready" && !processing && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={confirm}
            disabled={confirming}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {confirming ? "Confirming..." : "Looks right, confirm"}
          </button>
          <button
            onClick={onGenerate}
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium hover:border-accent"
          >
            Regenerate
          </button>
          <p className="w-full text-xs text-muted sm:w-auto">
            Confirming keeps the transcript and cleans up the audio files, per
            your Settings.
          </p>
        </div>
      )}

      {task.aiStatus === "confirmed" && !processing && (
        <button
          onClick={onGenerate}
          className="rounded-xl border border-line px-5 py-2.5 text-sm font-medium hover:border-accent"
        >
          Regenerate summary
        </button>
      )}

      {task.aiStatus === "ready" && task.aiError && (
        <p className="text-xs text-amber-700">{task.aiError}</p>
      )}
    </div>
  );
}
