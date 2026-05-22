import { memo } from "react";
import { motion } from "framer-motion";
import type { Message } from "../types";
import { useStore } from "../store/store";
import { Markdown } from "./Markdown";
import { RefreshIcon } from "./Icons";

interface Props {
  message: Message;
  /** True while this assistant message is actively receiving tokens. */
  streaming: boolean;
  /** True when this is the last message in the conversation. */
  isLast: boolean;
}

function MessageBubbleImpl({ message, streaming, isLast }: Props) {
  const regenerate = useStore((s) => s.regenerate);
  const anyStreaming = useStore((s) => s.streaming !== null);
  const isUser = message.role === "user";
  const empty = message.content.trim().length === 0;
  const canRegenerate =
    !isUser && !anyStreaming && (message.error || isLast);

  return (
    <motion.div
      className="msg"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className={`msg-avatar ${isUser ? "user" : "assistant"}`}>
        {isUser ? "You" : "O"}
      </div>
      <div className="msg-body">
        <div className="msg-role">{isUser ? "You" : "Orion"}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="msg-images">
            {message.attachments.map((a) => (
              <img
                key={a.id}
                src={`data:${a.mime};base64,${a.data}`}
                alt={a.name}
              />
            ))}
          </div>
        )}
        <div className={`msg-content ${message.error ? "error" : ""}`}>
          {isUser ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          ) : empty && streaming ? (
            <div className="thinking">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              <Markdown>{message.content}</Markdown>
              {streaming && !empty && <span className="caret" />}
            </>
          )}
        </div>
        {!isUser && message.usage && !streaming && (
          <div className="msg-usage" title="Tokens reported by the provider">
            {message.usage.input.toLocaleString()} in ·{" "}
            {message.usage.output.toLocaleString()} out
          </div>
        )}
        {canRegenerate && (
          <div className="msg-actions">
            <button className="msg-action" onClick={() => void regenerate()}>
              <RefreshIcon size={13} />
              {message.error ? "Retry" : "Regenerate"}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
