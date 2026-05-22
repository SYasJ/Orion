import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { MessageIcon, PlusIcon, SearchIcon, SettingsIcon } from "./Icons";

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  /** A matched-message snippet, shown under the label. */
  sub?: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Builds a short context window around the first match of `q` in `text`. */
function snippet(text: string, q: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const idx = flat.toLowerCase().indexOf(q);
  if (idx < 0) return flat.slice(0, 64);
  const start = Math.max(0, idx - 24);
  const end = Math.min(flat.length, idx + q.length + 44);
  return (
    (start > 0 ? "…" : "") +
    flat.slice(start, end) +
    (end < flat.length ? "…" : "")
  );
}

/** Ctrl/Cmd+K launcher: jump to conversations or run app actions. */
export function CommandPalette({ onClose, onOpenSettings }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversations = useStore((s) => s.conversations);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      {
        id: "new",
        label: "New chat",
        hint: "Action",
        icon: <PlusIcon size={15} />,
        run: () => {
          newConversation();
          onClose();
        },
      },
      {
        id: "settings",
        label: "Open settings",
        hint: "Action",
        icon: <SettingsIcon size={15} />,
        run: () => {
          onClose();
          onOpenSettings();
        },
      },
    ];

    const q = query.trim().toLowerCase();

    const convItems = [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map<Item | null>((c) => {
        let sub: string | undefined;
        if (q && !c.title.toLowerCase().includes(q)) {
          // Title missed — fall back to searching the message bodies.
          const hit = c.messages.find((m) =>
            m.content.toLowerCase().includes(q),
          );
          if (!hit) return null;
          sub = snippet(hit.content, q);
        }
        return {
          id: c.id,
          label: c.title,
          hint: "Conversation",
          sub,
          icon: <MessageIcon size={15} />,
          run: () => {
            selectConversation(c.id);
            onClose();
          },
        };
      })
      .filter((i): i is Item => i !== null);

    const visibleActions = q
      ? actions.filter((i) => i.label.toLowerCase().includes(q))
      : actions;
    return [...visibleActions, ...convItems];
  }, [query, conversations, newConversation, selectConversation, onOpenSettings, onClose]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[cursor]?.run();
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <motion.div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        <div className="palette-input">
          <SearchIcon size={17} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search conversations and messages, or run a command…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="palette-list">
          {items.length === 0 ? (
            <div className="palette-empty">No matches</div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id}
                className={`palette-item ${i === cursor ? "active" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={item.run}
              >
                {item.icon}
                <span className="pi-text">
                  <span className="pi-label">{item.label}</span>
                  {item.sub && <span className="pi-sub">{item.sub}</span>}
                </span>
                {item.hint && <span className="kbd">{item.hint}</span>}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
