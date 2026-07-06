"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { TaskCard, type TaskDensity } from "@/components/task-card";
import { log } from "@/lib/logger";
import { STATUS_ORDER, type TaskGroup } from "@/lib/tasks-view";
import { TASK_STATUS_LABELS, type TaskDto, type TaskStatus } from "@/lib/types";

const logger = log("ui board");

/** Movement beyond this many pixels between press and release counts as a drag, not a click. */
const CLICK_SLOP_PX = 6;

function DraggableCard({
  task,
  density,
  onOpen,
}: {
  task: TaskDto;
  density: TaskDensity;
  onOpen: () => void;
}) {
  // dnd-kit's attributes make the card focusable and keyboard-draggable
  // (space/enter to pick up). Opening a task is a plain click, distinguished
  // from a drag by how far the pointer traveled between press and release.
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
  });
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(e) => {
        pressAt.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        const start = pressAt.current;
        if (
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX
        ) {
          return; // that was a drag, not a click
        }
        onOpen();
      }}
      style={{ opacity: isDragging ? 0 : 1 }}
      className="cursor-grab rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
    >
      <TaskCard task={task} density={density} />
    </div>
  );
}

function StatusColumn({
  status,
  tasks,
  density,
  onOpen,
}: {
  status: TaskStatus;
  tasks: TaskDto[];
  density: TaskDensity;
  onOpen: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors ${
        isOver ? "border-accent bg-accent-soft/40" : "border-line bg-background"
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {TASK_STATUS_LABELS[status]}
        </h2>
        <span className="text-xs text-muted">{tasks.length}</span>
      </div>
      <div
        className={`flex flex-col ${density === "compact" ? "gap-1.5" : "gap-2.5"}`}
      >
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
            Nothing here
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableCard
              key={task.id}
              task={task}
              density={density}
              onOpen={() => onOpen(task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Kanban board. Columns are the statuses; dragging a card to another column
 * changes its status via onStatusChange. The whole board scrolls horizontally,
 * which is the expected board behavior on both desktop and touch.
 */
export function TaskBoardView({
  groups,
  density,
  onStatusChange,
}: {
  groups: TaskGroup[];
  density: TaskDensity;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const router = useRouter();
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);

  // Mouse drags on a small movement; touch requires a short press-hold so a
  // quick swipe still scrolls the column instead of grabbing a card.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: CLICK_SLOP_PX } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: CLICK_SLOP_PX },
    }),
    useSensor(KeyboardSensor),
  );

  const byStatus = new Map(groups.map((group) => [group.status, group.tasks]));
  const findTask = (id: string) =>
    groups.flatMap((group) => group.tasks).find((task) => task.id === id) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(findTask(String(event.active.id)));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const nextStatus = String(over.id) as TaskStatus;
    const task = findTask(String(active.id));
    if (task && task.status !== nextStatus) {
      logger.info("drag status change", {
        taskId: task.id,
        from: task.status,
        to: nextStatus,
      });
      onStatusChange(task.id, nextStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STATUS_ORDER.map((status) => (
          <StatusColumn
            key={status}
            status={status}
            tasks={byStatus.get(status) ?? []}
            density={density}
            onOpen={(id) => router.push(`/tasks/${id}`)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 rotate-1 cursor-grabbing opacity-95 shadow-lg">
            <TaskCard task={activeTask} density={density} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
