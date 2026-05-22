# Orion

A high-end desktop AI assistant — futuristic, fast, and practical.

Orion is a native desktop app (Tauri + React) that talks to multiple AI
providers behind one clean interface. Streaming replies, conversation history,
a command palette, and a glassy dark UI built for daily use.

![status](https://img.shields.io/badge/status-MVP-7c8cff)

## Features

- **Streaming chat** — tokens render live as the model produces them.
- **6 providers, one app** — Anthropic, OpenAI, Google Gemini, OpenRouter,
  Moonshot (Kimi) and Alibaba (Qwen), switchable per conversation.
- **Vision** — attach images to vision-capable models (Claude, GPT-4o,
  Gemini, Qwen-VL) for visual analysis.
- **Quick Ask overlay** — summon Orion from anywhere with
  `Ctrl/Cmd + Shift + Space`; promote any answer into a full conversation.
- **Conversation history** — auto-titled, searchable, persisted locally.
- **Command palette** — `Ctrl/Cmd + K` to jump between chats or run actions.
- **Markdown + code** — full markdown rendering with syntax highlighting.
- **System prompt** — customize Orion's behavior globally.
- **Frameless, glassy UI** — custom title bar, aurora accents, smooth motion.

## Providers & models

| Provider          | API format   | Example models                          |
| ----------------- | ------------ | --------------------------------------- |
| Anthropic         | `anthropic`  | Claude Opus / Sonnet / Haiku            |
| OpenAI            | `openai`     | GPT-4o, GPT-4o mini                     |
| Google Gemini     | `gemini`     | Gemini 2.5 Pro / Flash, 2.0 Flash       |
| OpenRouter        | `openai`     | DeepSeek V3, Llama 3.3, Qwen2.5-VL      |
| Moonshot · Kimi   | `openai`     | Kimi K2, Moonshot v1 128K               |
| Alibaba · Qwen    | `openai`     | Qwen Max / Plus / VL Max                |

Most providers are OpenAI-compatible, so adding one is a single entry in
`src/lib/providers.ts` plus its models in `src/lib/models.ts`. Gemini and
Anthropic have dedicated request/response handling in `src-tauri/src/providers.rs`.

## Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│  React frontend (webview)   │     │   Rust core (Tauri)      │
│                             │     │                          │
│  store ── bridge ──invoke──▶│────▶│  send_message            │
│                  ◀──events──│◀────│   └─ providers::stream   │
│  components                 │     │  get/set_settings        │
└─────────────────────────────┘     └──────────────────────────┘
```

API calls run in **Rust**, not the webview. This avoids browser CORS limits,
keeps API keys out of webview storage (they live in an OS-level config file),
and lets streaming use a real HTTP client. The frontend talks to the core via
`invoke` and receives tokens through `stream://chunk|done|error` events.

Adding a provider means one `match` arm in `src-tauri/src/providers.rs` plus an
entry in `src/lib/models.ts`.

## Project structure

```
src/                    React frontend
  components/            UI: TitleBar, Sidebar, ChatView, Composer, …
  store/store.ts         Zustand state + chat actions
  lib/bridge.ts          Typed wrapper over Tauri invoke/events
  lib/models.ts          Provider + model registry
  styles/global.css      Design system
src-tauri/src/           Rust core
  chat.rs                send_message / cancel_stream commands
  providers.rs           Anthropic + OpenAI SSE streaming
  settings.rs            Persisted API keys & config
```

## Prerequisites

- Node.js 18+
- Rust (stable)
- Tauri v2 system dependencies for your OS — see
  https://tauri.app/start/prerequisites/

## Getting started

```bash
npm install
npm run tauri:dev      # launches the desktop app
```

Then open **Settings** (gear icon, bottom-left) and add an Anthropic and/or
OpenAI API key. Keys are stored locally on your machine.

### Build a release binary

```bash
npm run tauri:build
```

### Frontend-only preview

`npm run dev` runs the UI in a browser for design work. The AI backend is only
available inside the desktop shell.

## Roadmap ideas

These are natural next steps to take Orion from MVP to polished product:

- Local model support via Ollama.
- Per-code-block copy buttons.
- Per-conversation model + system prompt overrides.
- Token/cost usage display.
- Conversation export (Markdown / JSON).
- System tray icon so Orion stays resident for Quick Ask.
