import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store/store";
import { getModel } from "../lib/models";
import { exportJson, exportMarkdown } from "../lib/export";
import { SlidersIcon } from "./Icons";

/** Header popover: per-chat system prompt, token usage, and export. */
export function ConversationSettings() {
  const conv = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeId),
  );
  const defaultSystemPrompt = useStore((s) => s.defaultSystemPrompt);
  const defaultModelId = useStore((s) => s.defaultModelId);
  const setConversationSystemPrompt = useStore(
    (s) => s.setConversationSystemPrompt,
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!conv) return null;
  const prompt = conv.systemPrompt ?? defaultSystemPrompt;
  const model = getModel(conv.modelId ?? defaultModelId);
  const totalTokens = conv.messages.reduce(
    (sum, m) => sum + (m.usage ? m.usage.input + m.usage.output : 0),
    0,
  );
  const hasMessages = conv.messages.length > 0;

  return (
    <div className="conv-settings" ref={ref}>
      <button
        className="icon-btn"
        title="Conversation settings"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersIcon size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="conv-pop"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
          >
            <div className="conv-pop-label">System prompt</div>
            <textarea
              className="conv-pop-textarea"
              value={prompt}
              spellCheck={false}
              placeholder="Instructions for this conversation…"
              onChange={(e) => setConversationSystemPrompt(e.target.value)}
            />
            <div className="conv-pop-hint">
              Applies only to this chat. Model: <strong>{model.label}</strong>,
              set via the picker.
            </div>

            <div className="conv-pop-divider" />

            <div className="conv-pop-row">
              <span className="conv-pop-label">Tokens used</span>
              <span className="conv-pop-value">
                {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
              </span>
            </div>

            <div className="conv-pop-divider" />

            <div className="conv-pop-label">Export conversation</div>
            <div className="conv-pop-actions">
              <button
                className="btn btn-ghost"
                disabled={!hasMessages}
                onClick={() => exportMarkdown(conv)}
              >
                Markdown
              </button>
              <button
                className="btn btn-ghost"
                disabled={!hasMessages}
                onClick={() => exportJson(conv)}
              >
                JSON
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
