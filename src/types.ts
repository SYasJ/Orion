export type Role = "user" | "assistant";

/** How a provider's HTTP API is shaped. Drives request/response handling. */
export type ApiFormat = "anthropic" | "openai" | "gemini";

/** An image attached to a message, for vision-capable models. */
export interface ImageAttachment {
  id: string;
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  name: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: ImageAttachment[];
  createdAt: number;
  /** Set when an assistant turn failed to complete. */
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ProviderDef {
  id: string;
  label: string;
  format: ApiFormat;
  /** Full chat endpoint URL, or API base for Gemini. */
  endpoint: string;
  /** True for local providers that need no API key (e.g. Ollama). */
  keyless?: boolean;
  keyPlaceholder: string;
  keyUrl: string;
  note: string;
}

export interface ModelDef {
  id: string;
  label: string;
  providerId: string;
  /** The identifier the provider's API expects. */
  apiName: string;
  blurb: string;
  /** True if the model can analyze image input. */
  vision?: boolean;
}

/** Persisted settings: one API key per provider id. */
export interface AppSettings {
  keys: Record<string, string>;
}
