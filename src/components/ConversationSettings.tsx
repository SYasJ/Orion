import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../store/store";
import { getModel } from "../lib/models";
import { SlidersIcon } from "./Icons";

/** Header popover for overriding the active conversation's system prompt. */
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
