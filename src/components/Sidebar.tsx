import { useStore } from "../store/store";
import { MessageIcon, PlusIcon, SearchIcon, SettingsIcon, TrashIcon } from "./Icons";

interface Props {
  onOpenSettings: () => void;
  onOpenPalette: () => void;
}

/** Left rail: new chat, conversation history, and app actions. */
export function Sidebar({ onOpenSettings, onOpenPalette }: Props) {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <button className="new-chat-btn" onClick={() => newConversation()}>
          <PlusIcon size={16} />
          New chat
        </button>
      </div>

      <div className="sidebar-list">
        {sorted.length === 0 ? (
          <div className="sidebar-section-label">No conversations yet</div>
        ) : (
          <>
            <div className="sidebar-section-label">Conversations</div>
            {sorted.map((c) => (
              <div
                key={c.id}
                className={`conv-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => selectConversation(c.id)}
              >
                <MessageIcon size={14} />
                <span className="conv-title">{c.title}</span>
                <button
                  className="conv-del"
                  title="Delete conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(c.id);
                  }}
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="sidebar-foot">
        <button className="foot-btn" onClick={onOpenPalette}>
          <SearchIcon size={15} />
          Search
          <span className="kbd">Ctrl K</span>
        </button>
        <button className="foot-btn" onClick={onOpenSettings}>
          <SettingsIcon size={15} />
          Settings
        </button>
      </div>
    </aside>
  );
}
