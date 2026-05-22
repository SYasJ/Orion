import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CheckIcon } from "./Icons";

/** A fenced code block with a hover copy button. */
function PreBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = ref.current?.innerText ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <div className="codeblock">
      <button className="copy-btn" onClick={copy}>
        {copied ? (
          <>
            <CheckIcon size={12} /> Copied
          </>
        ) : (
          "Copy"
        )}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

/** Shared markdown renderer: GFM, syntax highlighting, copyable code. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{ pre: PreBlock }}
    >
      {children}
    </ReactMarkdown>
  );
}
