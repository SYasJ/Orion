import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { SendIcon, StopIcon } from "./Icons";

/** Message input with auto-growing textarea and send/stop control. */
export function Composer() {
  const [text, setText] = useState("");
  const streaming = useStore((s) => s.streaming);
  const send = useStore((s) => s.send);
  const stop = useStore((s) => s.stop);
  const ref = useRef<HTMLTextAreaElement>(null);

  const isStreaming = streaming !== null;

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(resize, [text]);

  // Keep focus on the composer when a turn finishes.
  useEffect(() => {
    if (!isStreaming) ref.current?.focus();
  }, [isStreaming]);

  const submit = () => {
    const value = text.trim();
    if (!value || isStreaming) return;
    setText("");
    void send(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder="Ask Orion anything…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {isStreaming ? (
          <button
            className="send-btn stop"
            title="Stop generating"
            onClick={() => void stop()}
          >
            <StopIcon size={16} />
          </button>
        ) : (
          <button
            className="send-btn"
            title="Send"
            disabled={text.trim().length === 0}
            onClick={submit}
          >
            <SendIcon size={18} />
          </button>
        )}
      </div>
      <div className="composer-hint">
        <span>
          <span className="kbd">Enter</span> send
        </span>
        <span>
          <span className="kbd">Shift Enter</span> new line
        </span>
        <span>
          <span className="kbd">Ctrl K</span> command palette
        </span>
      </div>
    </div>
  );
}
