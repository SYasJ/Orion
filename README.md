# Orion

A high-end desktop AI assistant — futuristic, fast, and practical.

Orion is a native desktop app (Tauri + React) that talks to multiple AI
providers behind one clean interface. Streaming replies, conversation history,
a command palette, and a glassy dark UI built for daily use.

![status](https://img.shields.io/badge/status-MVP-7c8cff)

## Features

- **Streaming chat** — tokens render live as the model produces them.
- **Pluggable providers** — Claude (Anthropic) and GPT (OpenAI), switchable
  per conversation from the model picker.
- **Conversation history** — auto-titled, searchable, persisted locally.
- **Command palette** — `Ctrl/Cmd + K` to jump between chats or run actions.
- **Markdown + code** — full markdown rendering with syntax highlighting.
- **System prompt** — customize Orion's behavior globally.
- **Frameless, glassy UI** — custom title bar, aurora accents, smooth motion.

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

- Global hotkey "quick ask" overlay (summon Orion from anywhere).
- Local model support via Ollama.
- Streaming markdown with per-code-block copy buttons.
- Per-conversation model + system prompt overrides.
- Attachments and image input for multimodal models.
- Token/cost usage display.
- Conversation export (Markdown / JSON).
