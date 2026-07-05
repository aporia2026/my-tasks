import type { AiStatus } from "@/lib/types";

const STYLES: Record<AiStatus, { label: string; className: string }> = {
  idle: { label: "No AI summary", className: "text-muted border-line" },
  processing: {
    label: "Working...",
    className: "text-amber-700 border-amber-300 bg-amber-50",
  },
  ready: {
    label: "Summary ready",
    className: "text-accent border-accent bg-accent-soft",
  },
  confirmed: {
    label: "Confirmed",
    className: "text-emerald-700 border-emerald-300 bg-emerald-50",
  },
  failed: {
    label: "Failed",
    className: "text-red-700 border-red-300 bg-red-50",
  },
};

export function AiStatusBadge({ status }: { status: AiStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {status === "processing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {style.label}
    </span>
  );
}
