"use client";

/**
 * Browser-side audio extraction. The original video never leaves the
 * machine: ffmpeg.wasm pulls out the audio track, re-encodes it to 16kHz
 * mono 48kbps MP3, and splits it into ~10 minute chunks that sit far below
 * OpenAI's 25MB transcription cap.
 *
 * ffmpeg.wasm loads lazily (the core is ~31MB) and only when a recording is
 * actually dropped. Single-threaded core, so no cross-origin isolation
 * headers are needed.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

import { log } from "@/lib/logger";
import { DEFAULT_SEGMENT_SECONDS } from "@/lib/pipeline/segments";

const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

const logger = log("upload extract");

export interface ExtractedSegment {
  idx: number;
  blob: Blob;
  startSeconds: number;
  endSeconds: number;
}

export interface ExtractionResult {
  segments: ExtractedSegment[];
  durationSeconds: number;
}

export type ExtractionProgress =
  | { stage: "loading-ffmpeg" }
  | { stage: "extracting"; percent: number };

let ffmpegInstance: FFmpeg | null = null;

async function loadFfmpeg(
  onProgress: (p: ExtractionProgress) => void,
): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  onProgress({ stage: "loading-ffmpeg" });
  logger.info("loading ffmpeg core", { version: FFMPEG_CORE_VERSION });
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ffmpeg;
  logger.info("ffmpeg core loaded");
  return ffmpeg;
}

/** Reads media duration via a detached media element. */
export function readMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(
      file.type.startsWith("video/") ? "video" : "audio",
    );
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (!Number.isFinite(element.duration) || element.duration <= 0) {
        reject(new Error("Could not read the recording's duration."));
        return;
      }
      resolve(element.duration);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the recording's duration."));
    };
    element.src = url;
  });
}

export async function extractAudioSegments(
  file: File,
  onProgress: (p: ExtractionProgress) => void,
): Promise<ExtractionResult> {
  const durationSeconds = await readMediaDuration(file);
  logger.info("starting extraction", {
    name: file.name,
    sizeBytes: file.size,
    durationSeconds,
  });

  const ffmpeg = await loadFfmpeg(onProgress);
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress({
      stage: "extracting",
      percent: Math.max(0, Math.min(100, Math.round(progress * 100))),
    });
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile("input", await fetchFile(file));
    await ffmpeg.exec([
      "-i", "input",
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "48k",
      "-f", "segment",
      "-segment_time", String(DEFAULT_SEGMENT_SECONDS),
      "-reset_timestamps", "1",
      "chunk_%03d.mp3",
    ]);

    const entries = await ffmpeg.listDir("/");
    const chunkNames = entries
      .filter((e) => !e.isDir && e.name.startsWith("chunk_"))
      .map((e) => e.name)
      .sort();
    if (chunkNames.length === 0) {
      throw new Error("No audio track was found in this file.");
    }

    const segments: ExtractedSegment[] = [];
    for (let i = 0; i < chunkNames.length; i++) {
      const data = (await ffmpeg.readFile(chunkNames[i])) as Uint8Array;
      segments.push({
        idx: i,
        blob: new Blob([data.slice()], { type: "audio/mpeg" }),
        startSeconds: i * DEFAULT_SEGMENT_SECONDS,
        endSeconds: Math.min((i + 1) * DEFAULT_SEGMENT_SECONDS, durationSeconds),
      });
      await ffmpeg.deleteFile(chunkNames[i]);
    }
    await ffmpeg.deleteFile("input");

    logger.info("extraction finished", {
      chunks: segments.length,
      totalBytes: segments.reduce((sum, s) => sum + s.blob.size, 0),
    });
    return { segments, durationSeconds };
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
