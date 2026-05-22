import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { getModel } from "../lib/models";
import { BoltIcon, CodeIcon, ListIcon, SparkleIcon } from "./Icons";

const SUGGESTIONS = [
  {
    icon: BoltIcon,
    title: "Explain a concept",
    sub: "Break down how WebSockets work",
    prompt: "Explain how WebSockets work, with a simple analogy.",
  },
  {
    icon: CodeIcon,
    title: "Write code",
    sub: "A debounce function in TypeScript",
    prompt: "Write a typed debounce function in TypeScript and explain it.",
  },
  {
    icon: ListIcon,
    title: "Plan something",
    sub: "Outline a weekend project",
    prompt: "Help me plan a small weekend coding project I can finish in 2 days.",
  },
  {
    icon: SparkleIcon,
    title: "Brainstorm",
    sub: "Names for a new app",
    prompt: "Brainstorm 10 memorable names for a futuristic desktop AI assistant.",
  },
];

/** Shown when the active conversation has no messages yet. */
export function EmptyState() {
  const send = useStore((s) => s.send);
  const modelLabel = useStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return getModel(conv?.modelId ?? s.defaultModelId).label;
  });

  return (
    <div className="empty">
      <div className="empty-orb" />
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        How can I help?
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06, ease: "easeOut" }}
      >
        Ready on <strong>{modelLabel}</strong>. Ask a question below, or start
        from one of these.
      </motion.p>
      <div className="suggestions">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s.title}
            className="suggestion"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.28,
              delay: 0.12 + i * 0.05,
              ease: "easeOut",
            }}
            onClick={() => void send(s.prompt)}
          >
            <span className="suggestion-icon">
              <s.icon size={16} />
            </span>
            <span className="suggestion-text">
              <div className="suggestion-title">{s.title}</div>
              <div className="suggestion-sub">{s.sub}</div>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
