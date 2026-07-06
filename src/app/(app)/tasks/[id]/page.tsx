"use client";

import { useParams } from "next/navigation";

import { TaskWorkspace } from "@/components/task-workspace";

/** Deep-link page for a task; the board opens the same workspace in a modal. */
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-4xl">
      <TaskWorkspace taskId={id} />
    </div>
  );
}
