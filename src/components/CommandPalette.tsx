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
  icon: React.ReactNode;
  run: () => void;
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

    const convItems: Item[] = [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({
        id: c.id,
        label: c.title,
        hint: "Conversation",
        icon: <MessageIcon size={15} />,
        run: () => {
          selectConversation(c.id);
          onClose();
        },
      }));

    const q = query.trim().toLowerCase();
    const all = [...actions, ...convItems];
    return q
      ? all.filter((i) => i.label.toLowerCase().includes(q))
      : all;
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
            placeholder="Search conversations or run a command…"
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
                <span className="pi-label">{item.label}</span>
                {item.hint && <span className="kbd">{item.hint}</span>}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
