import { memo } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../types";

interface Props {
  message: Message;
  /** True while this assistant message is actively receiving tokens. */
  streaming: boolean;
}

function MessageBubbleImpl({ message, streaming }: Props) {
  const isUser = message.role === "user";
  const empty = message.content.trim().length === 0;

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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
              {streaming && !empty && <span className="caret" />}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
