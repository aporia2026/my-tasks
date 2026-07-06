"use client";

import { useState } from "react";

import type { CommentDto } from "@/lib/types";

function initials(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CommentThread({
  comments,
  currentUserId,
  onPost,
}: {
  comments: CommentDto[];
  currentUserId: string;
  onPost: (body: string) => Promise<boolean>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (body.trim().length === 0) return;
    setBusy(true);
    const ok = await onPost(body.trim());
    setBusy(false);
    if (ok) setBody("");
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Comments</h2>

      {comments.length === 0 ? (
        <p className="text-sm italic text-faint">No comments yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => {
            const mine = comment.author.id === currentUserId;
            const who = comment.author.name ?? comment.author.email;
            return (
              <div
                key={comment.id}
                className={`flex gap-2.5 ${mine ? "border-l-2 border-accent pl-3" : ""}`}
              >
                <span className="avatar" aria-hidden>
                  {initials(comment.author.name, comment.author.email)}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-foreground">{who}</span>{" "}
                    · {formatWhen(comment.createdAt)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment"
          rows={3}
          className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={busy || body.trim().length === 0}
            className="btn btn-primary btn-sm"
          >
            {busy ? "Posting..." : "Comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
