/**
 * OpenAI integration: transcription of audio segments and generation of the
 * task description + TLDR from every readable input on the task.
 *
 * API shapes verified against developers.openai.com docs on 2026-07-05:
 * - /v1/audio/transcriptions caps files at 25MB; gpt-4o-(mini-)transcribe
 *   return json only.
 * - PDFs go through the Files API (purpose "user_data") and are referenced
 *   with input_file in the Responses API; images via input_image URL.
 */

import OpenAI, { toFile } from "openai";

import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import type { Settings } from "@/lib/settings";
import { MAX_TODOS } from "@/lib/validation";

const logger = log("ai");

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env("OPENAI_API_KEY") });
  return client;
}

export async function transcribeSegment(
  blobUrl: string,
  fileName: string,
  model: Settings["transcriptionModel"],
): Promise<string> {
  logger.info("transcribing segment", { fileName, model });
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch segment blob (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  logger.info("segment fetched", { fileName, bytes: buffer.length });

  const result = await openai().audio.transcriptions.create({
    file: await toFile(buffer, fileName),
    model,
  });
  logger.info("segment transcribed", {
    fileName,
    transcriptChars: result.text.length,
  });
  return result.text;
}

export interface SummaryInput {
  title: string;
  notes: string | null;
  transcripts: Array<{ name: string; text: string }>;
  imageUrls: Array<{ name: string; url: string }>;
  documents: Array<{ name: string; url: string; mimeType: string }>;
}

export interface SummaryOutput {
  description: string;
  tldr: string;
  /** Ordered checklist of short, actionable sub-tasks. May be empty. */
  todos: string[];
}

export function buildSummaryPrompt(
  input: SummaryInput,
  tldrLength: Settings["tldrLength"],
): string {
  const sections: string[] = [
    `You are helping the owner of a personal task dashboard understand what a task requires.`,
    `Task title: ${input.title}`,
  ];
  if (input.notes) sections.push(`Owner's notes: ${input.notes}`);
  for (const t of input.transcripts) {
    sections.push(`Meeting transcript from "${t.name}":\n${t.text}`);
  }
  if (input.imageUrls.length > 0) {
    sections.push(
      `${input.imageUrls.length} screenshot(s) are attached as images.`,
    );
  }
  if (input.documents.length > 0) {
    sections.push(`${input.documents.length} document(s) are attached.`);
  }
  sections.push(
    [
      `Write three things, based only on the material above:`,
      `1. DESCRIPTION: a clear, complete description of what this task actually requires: context, decisions already made, constraints, and who expects what.`,
      `2. TLDR: ${
        tldrLength === "short"
          ? "2-4 sentences plus a short action list of exactly what the owner must do."
          : "a detailed action plan with every deliverable, deadline, and dependency mentioned."
      }`,
      `3. TODOS: an ordered checklist of 3-8 concrete sub-tasks the owner should complete to finish this task. Each is a short imperative phrase (for example "Draft the outreach email"), with no numbering inside the string.`,
      `Respond as JSON: {"description": "...", "tldr": "...", "todos": ["...", "..."]}. Plain text inside the strings, no markdown headings.`,
    ].join("\n"),
  );
  return sections.join("\n\n---\n\n");
}

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" }
  | { type: "input_file"; file_id: string };

export async function generateSummary(
  input: SummaryInput,
  settings: Settings,
): Promise<SummaryOutput> {
  const content: ContentPart[] = [
    { type: "input_text", text: buildSummaryPrompt(input, settings.tldrLength) },
  ];

  for (const image of input.imageUrls) {
    content.push({ type: "input_image", image_url: image.url, detail: "auto" });
  }

  for (const doc of input.documents) {
    logger.info("uploading document to OpenAI", { name: doc.name });
    const response = await fetch(doc.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch document ${doc.name} (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const file = await openai().files.create({
      file: await toFile(buffer, doc.name),
      purpose: "user_data",
    });
    content.push({ type: "input_file", file_id: file.id });
  }

  logger.info("generating summary", {
    model: settings.summaryModel,
    transcripts: input.transcripts.length,
    images: input.imageUrls.length,
    documents: input.documents.length,
  });

  const response = await openai().responses.create({
    model: settings.summaryModel,
    input: [{ role: "user", content }],
  });

  const parsed = parseSummaryResponse(response.output_text);
  logger.info("summary generated", {
    descriptionChars: parsed.description.length,
    tldrChars: parsed.tldr.length,
    todos: parsed.todos.length,
  });
  return parsed;
}

export interface TodosInput {
  title: string;
  notes: string | null;
  description: string | null;
  tldr: string | null;
}

/**
 * Regenerate just the checklist from a task's existing text, without redoing the
 * whole summary. Cheaper than generateSummary and used by the "Regenerate"
 * button, which already has a distilled description and TLDR to work from.
 */
export async function generateTodos(
  input: TodosInput,
  settings: Settings,
): Promise<string[]> {
  const sections = [
    `You are helping the owner of a personal task dashboard break a task into a short checklist of concrete next actions.`,
    `Task title: ${input.title}`,
  ];
  if (input.notes) sections.push(`Owner's notes: ${input.notes}`);
  if (input.description) sections.push(`Task description: ${input.description}`);
  if (input.tldr) sections.push(`What the owner needs to do: ${input.tldr}`);
  sections.push(
    `List 3-8 concrete sub-tasks the owner should complete to finish this task, each a short imperative phrase with no numbering. Respond as JSON: {"todos": ["...", "..."]}.`,
  );

  logger.info("generating todos", { model: settings.summaryModel });
  const response = await openai().responses.create({
    model: settings.summaryModel,
    input: [
      { role: "user", content: [{ type: "input_text", text: sections.join("\n\n---\n\n") }] },
    ],
  });
  const todos = parseTodosResponse(response.output_text);
  logger.info("todos generated", { count: todos.length });
  return todos;
}

/** Best-effort array of clean, bounded todo strings; [] on anything unparsable. */
export function parseTodosResponse(raw: string): string[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { todos?: unknown };
    if (!Array.isArray(parsed.todos)) return [];
    return parsed.todos
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().slice(0, 300))
      .filter((t) => t.length > 0)
      .slice(0, MAX_TODOS);
  } catch {
    return [];
  }
}

/** Tolerates code fences and stray text around the JSON body. */
export function parseSummaryResponse(raw: string): SummaryOutput {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model response contained no JSON object");
  }
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).description !== "string" ||
    typeof (parsed as Record<string, unknown>).tldr !== "string"
  ) {
    throw new Error("Model response JSON missing description/tldr strings");
  }
  const obj = parsed as { description: string; tldr: string; todos?: unknown };
  // Todos are best-effort: a missing or malformed list must not fail the summary.
  const todos = Array.isArray(obj.todos)
    ? obj.todos
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 300))
        .filter((t) => t.length > 0)
        .slice(0, MAX_TODOS)
    : [];
  return { description: obj.description, tldr: obj.tldr, todos };
}
