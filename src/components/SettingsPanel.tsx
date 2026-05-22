import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { useStore } from "../store/store";
import { IS_TAURI, getSettings, setSettings } from "../lib/bridge";
import { PROVIDERS } from "../lib/providers";
import { CloseIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

/** Modal for per-provider API keys and the global system prompt. */
export function SettingsPanel({ onClose }: Props) {
  const systemPrompt = useStore((s) => s.systemPrompt);
  const setSystemPrompt = useStore((s) => s.setSystemPrompt);

  const [keys, setKeys] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState(systemPrompt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setKeys(s.keys ?? {}));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setSettings({ keys });
      setSystemPrompt(prompt);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <motion.div
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-body">
          {!IS_TAURI && (
            <span className="hint">
              Running in a browser — API keys won't be saved and chat is
              disabled. Launch the desktop app with{" "}
              <code>npm run tauri:dev</code>.
            </span>
          )}

          <div className="settings-section-label">API keys</div>
          <p className="hint" style={{ marginTop: -8 }}>
            Add a key only for the providers you want to use. Keys are stored
            locally on this device.
          </p>

          {PROVIDERS.map((p) => (
            <div className="field" key={p.id}>
              <label>
                {p.label}
                <button
                  className="key-link"
                  onClick={() => {
                    if (IS_TAURI) void openUrl(p.keyUrl);
                  }}
                >
                  get a key ↗
                </button>
              </label>
              <input
                type="password"
                value={keys[p.id] ?? ""}
                placeholder={p.keyPlaceholder}
                onChange={(e) =>
                  setKeys((k) => ({ ...k, [p.id]: e.target.value }))
                }
                autoComplete="off"
                spellCheck={false}
              />
              <span className="hint">{p.note}</span>
            </div>
          ))}

          <div className="settings-section-label">Behavior</div>
          <div className="field">
            <label>System prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              spellCheck={false}
            />
            <span className="hint">
              Sets Orion's behavior for every conversation.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
