import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { IS_TAURI, getSettings, setSettings } from "../lib/bridge";
import { CloseIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

/** Modal for API keys and the global system prompt. */
export function SettingsPanel({ onClose }: Props) {
  const systemPrompt = useStore((s) => s.systemPrompt);
  const setSystemPrompt = useStore((s) => s.setSystemPrompt);

  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [prompt, setPrompt] = useState(systemPrompt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setAnthropicKey(s.anthropicApiKey);
      setOpenaiKey(s.openaiApiKey);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setSettings({ anthropicApiKey: anthropicKey, openaiApiKey: openaiKey });
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
            <div className="field">
              <span className="hint">
                Running in a browser — API keys won't be saved and chat is
                disabled. Launch the desktop app with{" "}
                <code>npm run tauri:dev</code>.
              </span>
            </div>
          )}

          <div className="field">
            <label>Anthropic API key</label>
            <input
              type="password"
              value={anthropicKey}
              placeholder="sk-ant-…"
              onChange={(e) => setAnthropicKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">Used for Claude models. Stored locally on this device.</span>
          </div>

          <div className="field">
            <label>OpenAI API key</label>
            <input
              type="password"
              value={openaiKey}
              placeholder="sk-…"
              onChange={(e) => setOpenaiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">Used for GPT models. Stored locally on this device.</span>
          </div>

          <div className="field">
            <label>System prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              spellCheck={false}
            />
            <span className="hint">Sets Orion's behavior for every conversation.</span>
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
