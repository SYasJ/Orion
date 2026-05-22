import type { Conversation } from "../types";
import { getModel } from "./models";

/** Triggers a client-side file download. */
function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "conversation"
  );
}

/** Exports a conversation as a readable Markdown transcript. */
export function exportMarkdown(conv: Conversation): void {
  const lines: string[] = [
    `# ${conv.title}`,
    "",
    `*${new Date(conv.createdAt).toLocaleString()} · ${getModel(conv.modelId).label}*`,
    "",
  ];
  for (const m of conv.messages) {
    lines.push(`## ${m.role === "user" ? "You" : "Orion"}`, "");
    lines.push(m.content.trim() || "_(empty)_", "");
  }
  download(`${slug(conv.title)}.md`, lines.join("\n"), "text/markdown");
}

/** Exports a conversation as raw JSON, preserving all fields. */
export function exportJson(conv: Conversation): void {
  download(
    `${slug(conv.title)}.json`,
    JSON.stringify(conv, null, 2),
    "application/json",
  );
}
