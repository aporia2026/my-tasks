"use client";

import { useEffect, useState } from "react";

import { log } from "@/lib/logger";

const logger = log("ui settings");

interface SettingsDto {
  summaryModel: string;
  transcriptionModel: string;
  tldrLength: string;
  mediaRetention: string;
  autoProcessOnUpload: boolean;
  confirmBeforeRegenerate: boolean;
  theme: string;
  defaultView: string;
  taskDensity: string;
}

interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 max-w-md text-xs text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function SettingSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SettingToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        value ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsDto | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((body: { settings: SettingsDto }) => setSettings(body.settings))
      .catch(() => setError("Could not load settings."));
  }, []);

  async function save(patch: Partial<SettingsDto>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaved(false);
    logger.info("saving settings", { keys: Object.keys(patch) });
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError("Saving failed. Your change was not stored.");
      return;
    }
    setError(null);
    setSaved(true);
  }

  if (!settings) {
    return <p className="text-center text-sm text-muted">Loading settings...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted">
        Changes save automatically.
        {saved && <span className="ml-2 text-accent">Saved.</span>}
      </p>
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          AI
        </h2>
        <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface px-5">
          <SettingRow
            label="Summary model"
            hint="Writes the description and TLDR. Mini is smarter; nano is cheaper."
          >
            <SettingSelect
              value={settings.summaryModel}
              onChange={(v) => void save({ summaryModel: v })}
              options={[
                { value: "gpt-5.4-mini", label: "GPT-5.4 mini (recommended)" },
                { value: "gpt-5.4-nano", label: "GPT-5.4 nano (cheapest)" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Transcription model"
            hint="Turns recordings into text. Mini costs about $0.18 per hour of audio."
          >
            <SettingSelect
              value={settings.transcriptionModel}
              onChange={(v) => void save({ transcriptionModel: v })}
              options={[
                {
                  value: "gpt-4o-mini-transcribe",
                  label: "Mini transcribe (recommended)",
                },
                { value: "gpt-4o-transcribe", label: "Full transcribe (2x cost)" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="TLDR length"
            hint="How much detail the action summary goes into."
          >
            <SettingSelect
              value={settings.tldrLength}
              onChange={(v) => void save({ tldrLength: v })}
              options={[
                { value: "short", label: "Short and sharp" },
                { value: "detailed", label: "Detailed plan" },
              ]}
            />
          </SettingRow>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Files
        </h2>
        <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface px-5">
          <SettingRow
            label="Audio cleanup"
            hint="Transcripts are always kept forever. This only controls the uploaded audio files."
          >
            <SettingSelect
              value={settings.mediaRetention}
              onChange={(v) => void save({ mediaRetention: v })}
              options={[
                {
                  value: "after_confirm",
                  label: "Delete after I confirm the summary",
                },
                { value: "days_30", label: "Keep for 30 days" },
                { value: "forever", label: "Keep forever" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Start processing right after upload"
            hint="Off means you press the generate button yourself."
          >
            <SettingToggle
              value={settings.autoProcessOnUpload}
              onChange={(v) => void save({ autoProcessOnUpload: v })}
            />
          </SettingRow>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Appearance
        </h2>
        <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface px-5">
          <SettingRow
            label="Default layout"
            hint="List groups tasks by status; Board is columns you drag cards between. You can also switch on the dashboard."
          >
            <SettingSelect
              value={settings.defaultView}
              onChange={(v) => void save({ defaultView: v })}
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
              ]}
            />
          </SettingRow>
          <SettingRow
            label="Task density"
            hint="Roomy shows a summary preview on each card; Compact fits more on screen."
          >
            <SettingSelect
              value={settings.taskDensity}
              onChange={(v) => void save({ taskDensity: v })}
              options={[
                { value: "comfortable", label: "Roomy" },
                { value: "compact", label: "Compact" },
              ]}
            />
          </SettingRow>
          <SettingRow label="Theme" hint="System follows your device preference.">
            <SettingSelect
              value={settings.theme}
              onChange={(v) => {
                void save({ theme: v });
                if (v === "system") {
                  delete document.documentElement.dataset.theme;
                  localStorage.removeItem("mt-theme");
                } else {
                  document.documentElement.dataset.theme = v;
                  localStorage.setItem("mt-theme", v);
                }
              }}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </SettingRow>
        </div>
      </section>
    </div>
  );
}
