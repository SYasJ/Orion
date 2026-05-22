import type { ProviderDef } from "../types";

/**
 * Provider registry. Most providers are OpenAI-compatible, so they share the
 * "openai" format and differ only by endpoint and key. Add a provider here and
 * one or more models in models.ts to expose it.
 */
export const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    format: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Claude — deep reasoning, vision",
  },
  {
    id: "openai",
    label: "OpenAI",
    format: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    note: "GPT — flagship multimodal models",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    format: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Gemini — fast, long-context, vision",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    format: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyPlaceholder: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    note: "One key, hundreds of models",
  },
  {
    id: "moonshot",
    label: "Moonshot · Kimi",
    format: "openai",
    endpoint: "https://api.moonshot.ai/v1/chat/completions",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    note: "Kimi — long-context reasoning",
  },
  {
    id: "dashscope",
    label: "Alibaba · Qwen",
    format: "openai",
    endpoint:
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    keyPlaceholder: "sk-…",
    keyUrl: "https://bailian.console.alibabacloud.com/",
    note: "Qwen — incl. vision-language models",
  },
  {
    id: "ollama",
    label: "Ollama · Local",
    format: "openai",
    endpoint: "http://localhost:11434/v1/chat/completions",
    keyless: true,
    keyPlaceholder: "",
    keyUrl: "https://ollama.com/download",
    note: "Runs models locally — no API key, fully private",
  },
];

export function getProvider(id: string): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
