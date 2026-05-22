import type { ModelDef } from "../types";
import { getProvider } from "./providers";

/** Models Orion can route to. Grouped by provider in the UI. */
export const MODELS: ModelDef[] = [
  // ---- Anthropic ----
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    providerId: "anthropic",
    apiName: "claude-opus-4-7",
    blurb: "Most capable — deep reasoning",
    vision: true,
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    providerId: "anthropic",
    apiName: "claude-sonnet-4-6",
    blurb: "Balanced speed and quality",
    vision: true,
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    providerId: "anthropic",
    apiName: "claude-haiku-4-5-20251001",
    blurb: "Fastest — everyday tasks",
    vision: true,
  },

  // ---- OpenAI ----
  {
    id: "gpt-4o",
    label: "GPT-4o",
    providerId: "openai",
    apiName: "gpt-4o",
    blurb: "Flagship multimodal",
    vision: true,
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    providerId: "openai",
    apiName: "gpt-4o-mini",
    blurb: "Fast and economical",
    vision: true,
  },

  // ---- Google Gemini ----
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    providerId: "gemini",
    apiName: "gemini-2.5-pro",
    blurb: "Top reasoning, huge context",
    vision: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    providerId: "gemini",
    apiName: "gemini-2.5-flash",
    blurb: "Fast, balanced, multimodal",
    vision: true,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    providerId: "gemini",
    apiName: "gemini-2.0-flash",
    blurb: "Quick everyday multimodal",
    vision: true,
  },

  // ---- OpenRouter ----
  {
    id: "or-deepseek-v3",
    label: "DeepSeek V3",
    providerId: "openrouter",
    apiName: "deepseek/deepseek-chat",
    blurb: "Strong open reasoning model",
  },
  {
    id: "or-llama-3.3-70b",
    label: "Llama 3.3 70B",
    providerId: "openrouter",
    apiName: "meta-llama/llama-3.3-70b-instruct",
    blurb: "Meta's open flagship",
  },
  {
    id: "or-qwen-vl-72b",
    label: "Qwen2.5-VL 72B",
    providerId: "openrouter",
    apiName: "qwen/qwen2.5-vl-72b-instruct",
    blurb: "Open vision-language model",
    vision: true,
  },

  // ---- Moonshot · Kimi ----
  {
    id: "kimi-k2",
    label: "Kimi K2",
    providerId: "moonshot",
    apiName: "kimi-k2-0905-preview",
    blurb: "Agentic long-context model",
  },
  {
    id: "moonshot-128k",
    label: "Moonshot v1 128K",
    providerId: "moonshot",
    apiName: "moonshot-v1-128k",
    blurb: "Very long context window",
  },

  // ---- Alibaba · Qwen ----
  {
    id: "qwen-max",
    label: "Qwen Max",
    providerId: "dashscope",
    apiName: "qwen-max",
    blurb: "Alibaba's most capable",
  },
  {
    id: "qwen-plus",
    label: "Qwen Plus",
    providerId: "dashscope",
    apiName: "qwen-plus",
    blurb: "Balanced cost and quality",
  },
  {
    id: "qwen-vl-max",
    label: "Qwen VL Max",
    providerId: "dashscope",
    apiName: "qwen-vl-max",
    blurb: "Vision-language analysis",
    vision: true,
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

/** Ollama model ids carry the prefix below so they can be resolved without a
 *  static registry — the rest of the id is the live model name. */
export const OLLAMA_PREFIX = "ollama:";

const OLLAMA_VISION = /llava|vision|-vl\b|bakllava|moondream/;

/** Builds a ModelDef from a live Ollama model name (e.g. "llava:latest"). */
export function ollamaModel(name: string): ModelDef {
  return {
    id: `${OLLAMA_PREFIX}${name}`,
    label: name,
    providerId: "ollama",
    apiName: name,
    blurb: "Local via Ollama",
    vision: OLLAMA_VISION.test(name.toLowerCase()),
  };
}

export function getModel(id: string): ModelDef {
  if (id.startsWith(OLLAMA_PREFIX)) {
    return ollamaModel(id.slice(OLLAMA_PREFIX.length));
  }
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** Resolves a model id to everything the backend needs to call it. */
export function resolveModel(id: string) {
  const model = getModel(id);
  const provider = getProvider(model.providerId);
  return { model, provider };
}
