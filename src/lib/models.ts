import type { ModelDef, ProviderId } from "../types";

/** Models Orion can route to. Add entries here to expose new options. */
export const MODELS: ModelDef[] = [
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    provider: "anthropic",
    apiName: "claude-opus-4-7",
    blurb: "Most capable — deep reasoning",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    apiName: "claude-sonnet-4-6",
    blurb: "Balanced speed and quality",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    apiName: "claude-haiku-4-5-20251001",
    blurb: "Fastest — everyday tasks",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    apiName: "gpt-4o",
    blurb: "OpenAI flagship multimodal",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    provider: "openai",
    apiName: "gpt-4o-mini",
    blurb: "OpenAI — fast and economical",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
};
