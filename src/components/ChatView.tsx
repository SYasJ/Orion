import { useEffect, useRef } from "react";
import { useStore } from "../store/store";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { ModelSwitcher } from "./ModelSwitcher";
import { ConversationSettings } from "./ConversationSettings";

/** The main conversation pane: header, message list, and composer. */
export function ChatView() {
  const activeId = useStore((s) => s.activeId);
  const conversation = useStore(
    (s) => s.conversations.find((c) => c.id === s.activeId) ?? null,
  );
  const streaming = useStore((s) => s.streaming);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];
  const lastLen = messages[messages.length - 1]?.content.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastLen, activeId]);

  const isEmpty = messages.length === 0;

  return (
    <main className="chat">
      <div className="chat-header">
        <div className="chat-header-title">
          {conversation?.title ?? "Orion"}
        </div>
        <div className="chat-header-spacer" />
        <ModelSwitcher />
        <ConversationSettings />
      </div>

      <div className="scroll-area" ref={scrollRef}>
        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="messages">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                streaming={streaming?.messageId === m.id}
              />
            ))}
          </div>
        )}
      </div>

      <Composer />
    </main>
  );
}
