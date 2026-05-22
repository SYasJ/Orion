export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
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

export type ProviderId = "anthropic" | "openai";

export interface ModelDef {
  id: string;
  label: string;
  provider: ProviderId;
  /** The identifier the provider's API expects. */
  apiName: string;
  blurb: string;
}

export interface AppSettings {
  anthropicApiKey: string;
  openaiApiKey: string;
}
