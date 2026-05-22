import { useStore } from "../store/store";

const SUGGESTIONS = [
  {
    title: "Explain a concept",
    sub: "Break down how WebSockets work",
    prompt: "Explain how WebSockets work, with a simple analogy.",
  },
  {
    title: "Write code",
    sub: "A debounce function in TypeScript",
    prompt: "Write a typed debounce function in TypeScript and explain it.",
  },
  {
    title: "Plan something",
    sub: "Outline a weekend project",
    prompt: "Help me plan a small weekend coding project I can finish in 2 days.",
  },
  {
    title: "Brainstorm",
    sub: "Names for a new app",
    prompt: "Brainstorm 10 memorable names for a futuristic desktop AI assistant.",
  },
];

/** Shown when the active conversation has no messages yet. */
export function EmptyState() {
  const send = useStore((s) => s.send);

  return (
    <div className="empty">
      <div className="empty-orb" />
      <h1>How can I help?</h1>
      <p>
        Orion is ready. Ask a question below, or start from one of these.
      </p>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            className="suggestion"
            onClick={() => void send(s.prompt)}
          >
            <div className="suggestion-title">{s.title}</div>
            <div className="suggestion-sub">{s.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
