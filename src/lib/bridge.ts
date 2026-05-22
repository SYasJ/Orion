import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppSettings } from "../types";

/** True when running inside the Tauri shell (vs. a plain browser tab). */
export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ChatMessageDTO {
  role: "user" | "assistant";
  content: string;
}

export interface SendArgs {
  streamId: string;
  provider: string;
  model: string;
  system: string;
  messages: ChatMessageDTO[];
}

export interface ChunkEvent {
  id: string;
  delta: string;
}

export interface DoneEvent {
  id: string;
}

export interface ErrorEvent {
  id: string;
  message: string;
}

export async function sendMessage(args: SendArgs): Promise<void> {
  if (!IS_TAURI) {
    throw new Error(
      "Orion's AI backend is only available in the desktop app. Run `npm run tauri:dev`.",
    );
  }
  await invoke("send_message", {
    streamId: args.streamId,
    request: {
      provider: args.provider,
      model: args.model,
      system: args.system,
      messages: args.messages,
      maxTokens: 4096,
    },
  });
}

export async function cancelStream(streamId: string): Promise<void> {
  if (!IS_TAURI) return;
  await invoke("cancel_stream", { streamId });
}

export async function getSettings(): Promise<AppSettings> {
  if (!IS_TAURI) return { anthropicApiKey: "", openaiApiKey: "" };
  return invoke<AppSettings>("get_settings");
}

export async function setSettings(settings: AppSettings): Promise<void> {
  if (!IS_TAURI) return;
  await invoke("set_settings", { settings });
}

export function onChunk(cb: (e: ChunkEvent) => void): Promise<UnlistenFn> {
  return listen<ChunkEvent>("stream://chunk", (e) => cb(e.payload));
}

export function onDone(cb: (e: DoneEvent) => void): Promise<UnlistenFn> {
  return listen<DoneEvent>("stream://done", (e) => cb(e.payload));
}

export function onError(cb: (e: ErrorEvent) => void): Promise<UnlistenFn> {
  return listen<ErrorEvent>("stream://error", (e) => cb(e.payload));
}
