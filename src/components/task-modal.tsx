"use client";

import { useEffect, useRef } from "react";

import { TaskWorkspace } from "@/components/task-workspace";
import type { TaskDto } from "@/lib/types";

/**
 * Big centered popup that hosts a TaskWorkspace over the board. Opens with a
 * quick fade/scale (CSS, reduced-motion aware), closes on Escape, backdrop
 * click, or the X. Locks body scroll and moves focus in (restoring it on close)
 * so it behaves like a proper dialog. The deep-link page renders the same
 * workspace without this chrome.
 */
export function TaskModal({
  taskId,
  initialTask,
  onClose,
  onChanged,
}: {
  taskId: string;
  initialTask?: TaskDto;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const prevFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:p-6"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="modal-panel relative my-4 w-full max-w-3xl rounded-2xl border border-line bg-background p-6 shadow-lg outline-none sm:my-8 sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
        >
          ✕
        </button>
        <TaskWorkspace
          taskId={taskId}
          initialTask={initialTask}
          onClose={onClose}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
