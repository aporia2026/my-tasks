"use client";

import { useRef, useState } from "react";

import { log } from "@/lib/logger";
import { processFileUpload, type UploadStage } from "@/lib/client/upload";

const logger = log("ui dropzone");

interface FileProgress {
  id: string;
  name: string;
  stage: UploadStage | { stage: "done" } | { stage: "error"; message: string };
}

function stageLabel(progress: FileProgress["stage"]): string {
  switch (progress.stage) {
    case "preparing":
      return "Preparing...";
    case "loading-ffmpeg":
      return "Loading audio engine (first time only)...";
    case "extracting":
      return `Extracting audio ${progress.percent}%`;
    case "uploading":
      return `Uploading ${progress.current} of ${progress.total}`;
    case "registering":
      return "Finishing up...";
    case "done":
      return "Uploaded";
    case "error":
      return progress.message;
  }
}

export function UploadDropzone({
  taskId,
  onUploaded,
}: {
  taskId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<FileProgress[]>([]);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const selected = Array.from(list);
    logger.info("files dropped", { count: selected.length });

    for (const file of selected) {
      const entry: FileProgress = {
        id: crypto.randomUUID(),
        name: file.name,
        stage: { stage: "preparing" },
      };
      setFiles((prev) => [...prev, entry]);
      const update = (stage: FileProgress["stage"]) =>
        setFiles((prev) =>
          prev.map((f) => (f.id === entry.id ? { ...f, stage } : f)),
        );
      try {
        await processFileUpload(taskId, file, update);
        update({ stage: "done" });
        onUploaded();
      } catch (error) {
        logger.error("upload failed", {
          name: file.name,
          message: (error as Error).message,
        });
        update({ stage: "error", message: (error as Error).message });
      }
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-surface"
        }`}
      >
        <p className="text-sm font-medium">
          Drop a meeting recording, screenshot, or document here
        </p>
        <p className="mt-1 text-xs text-muted">
          Video and audio are transcribed. Images and PDFs are read as-is. Or
          click to pick a file.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,video/*,image/*,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <span
                className={`ml-4 shrink-0 text-xs ${
                  file.stage.stage === "error"
                    ? "text-red-600"
                    : file.stage.stage === "done"
                      ? "text-accent"
                      : "text-muted"
                }`}
              >
                {stageLabel(file.stage)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
