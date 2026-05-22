import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { useStore } from "./store/store";
import { onChunk, onDone, onError } from "./lib/bridge";

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pushDelta = useStore((s) => s.pushDelta);
  const endStream = useStore((s) => s.endStream);
  const failStream = useStore((s) => s.failStream);

  // Bridge Rust stream events into the store.
  useEffect(() => {
    let active = true;
    const handles: UnlistenFn[] = [];
    Promise.all([
      onChunk((e) => pushDelta(e.id, e.delta)),
      onDone((e) => endStream(e.id)),
      onError((e) => failStream(e.id, e.message)),
    ]).then((fns) => {
      if (active) handles.push(...fns);
      else fns.forEach((f) => f());
    });
    return () => {
      active = false;
      handles.forEach((f) => f());
    };
  }, [pushDelta, endStream, failStream]);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useStore.getState().newConversation();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <div className="body-row">
        <Sidebar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <ChatView />
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
