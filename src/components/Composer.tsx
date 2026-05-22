import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/store";
import { getModel } from "../lib/models";
import type { ImageAttachment } from "../types";
import { CloseIcon, ImageIcon, SendIcon, StopIcon } from "./Icons";

/** Reads a file into a base64 image attachment. */
function fileToAttachment(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        id: crypto.randomUUID(),
        mime: file.type || "image/png",
        data: result.slice(result.indexOf(",") + 1),
        name: file.name,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Message input: auto-growing textarea, image attachments, send/stop. */
export function Composer() {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const streaming = useStore((s) => s.streaming);
  const send = useStore((s) => s.send);
  const stop = useStore((s) => s.stop);
  const modelId = useStore((s) => s.modelId);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isStreaming = streaming !== null;
  const supportsVision = getModel(modelId).vision === true;
  const canSend = text.trim().length > 0 || images.length > 0;

  const resize = () => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  useEffect(resize, [text]);

  useEffect(() => {
    if (!isStreaming) textRef.current?.focus();
  }, [isStreaming]);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    e.target.value = "";
    const added = await Promise.all(files.map(fileToAttachment));
    setImages((prev) => [...prev, ...added].slice(0, 6));
  };

  const submit = () => {
    if (!canSend || isStreaming) return;
    const value = text;
    const attached = images;
    setText("");
    setImages([]);
    void send(value, attached);
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
        {images.length > 0 && (
          <div className="composer-previews">
            {images.map((img) => (
              <div className="thumb" key={img.id}>
                <img src={`data:${img.mime};base64,${img.data}`} alt={img.name} />
                <button
                  className="thumb-x"
                  title="Remove"
                  onClick={() =>
                    setImages((p) => p.filter((i) => i.id !== img.id))
                  }
                >
                  <CloseIcon size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-row">
          {supportsVision && (
            <button
              className="attach-btn"
              title="Attach image"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon size={18} />
            </button>
          )}
          <textarea
            ref={textRef}
            value={text}
            rows={1}
            placeholder={
              supportsVision
                ? "Ask Orion, or attach an image…"
                : "Ask Orion anything…"
            }
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
              disabled={!canSend}
              onClick={submit}
            >
              <SendIcon size={18} />
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onFiles}
        />
      </div>

      <div className="composer-hint">
        <span>
          <span className="kbd">Enter</span> send
        </span>
        <span>
          <span className="kbd">Shift Enter</span> new line
        </span>
        <span>
          <span className="kbd">Ctrl K</span> palette
        </span>
        <span>
          <span className="kbd">Ctrl Shift Space</span> quick ask
        </span>
      </div>
    </div>
  );
}
