import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppSettings } from "../types";
import { getProvider } from "./providers";

/** True when running inside the Tauri shell (vs. a plain browser tab). */
export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface ChatImageDTO {
  mime: string;
  data: string;
}

export interface ChatMessageDTO {
  role: "user" | "assistant";
  content: string;
  images: ChatImageDTO[];
}

export interface SendArgs {
  streamId: string;
  /** Provider id — used to look up the API key. */
  provider: string;
  /** API shape: "anthropic" | "openai" | "gemini". */
  format: string;
  /** Endpoint URL (chat completions, or API base for Gemini). */
  endpoint: string;
  /** False for local providers (Ollama) that need no API key. */
  requiresKey: boolean;
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

export interface UsageEvent {
  id: string;
  inputTokens: number;
  outputTokens: number;
}

/** Payload for promoting a Quick Ask exchange into a full conversation. */
export interface PromoteEvent {
  question: string;
  answer: string;
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
      format: args.format,
      endpoint: args.endpoint,
      requiresKey: args.requiresKey,
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
  if (!IS_TAURI) return { keys: {} };
  return invoke<AppSettings>("get_settings");
}

export async function setSettings(settings: AppSettings): Promise<void> {
  if (!IS_TAURI) return;
  await invoke("set_settings", { settings });
}

/** Lists models installed in the local Ollama instance. */
export async function listOllamaModels(): Promise<string[]> {
  if (!IS_TAURI) return [];
  const host = getProvider("ollama").endpoint.replace(/\/v1\/.*$/, "");
  return invoke<string[]>("list_ollama_models", { host });
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

export function onUsage(cb: (e: UsageEvent) => void): Promise<UnlistenFn> {
  return listen<UsageEvent>("stream://usage", (e) => cb(e.payload));
}

/** Sends a Quick Ask exchange to the main window to become a conversation. */
export async function promoteToConversation(e: PromoteEvent): Promise<void> {
  await emit("quickask://promote", e);
}

export function onPromote(cb: (e: PromoteEvent) => void): Promise<UnlistenFn> {
  return listen<PromoteEvent>("quickask://promote", (e) => cb(e.payload));
}
