"use client";

import type { TaskDensity } from "@/components/task-card";

export type ViewMode = "list" | "board";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-line bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === option.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DashboardToolbar({
  view,
  density,
  search,
  onView,
  onDensity,
  onSearch,
}: {
  view: ViewMode;
  density: TaskDensity;
  search: string;
  onView: (view: ViewMode) => void;
  onDensity: (density: TaskDensity) => void;
  onSearch: (search: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search tasks"
        className="w-full rounded-xl border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-accent sm:max-w-xs"
      />
      <div className="flex items-center gap-2">
        <Segmented
          ariaLabel="Layout"
          value={view}
          onChange={onView}
          options={[
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ]}
        />
        <Segmented
          ariaLabel="Density"
          value={density}
          onChange={onDensity}
          options={[
            { value: "comfortable", label: "Roomy" },
            { value: "compact", label: "Compact" },
          ]}
        />
      </div>
    </div>
  );
}
