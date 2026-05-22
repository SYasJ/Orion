import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../store/store";
import { getModel, resolveModel } from "../lib/models";
import {
  IS_TAURI,
  cancelStream,
  onChunk,
  onDone,
  onError,
  promoteToConversation,
  sendMessage,
} from "../lib/bridge";
import { ArrowRightIcon, SparkleIcon, StopIcon } from "./Icons";
import { Markdown } from "./Markdown";

/**
 * The Quick Ask overlay — a compact, always-ready window summoned with
 * Ctrl/Cmd+Shift+Space. Single-turn; an exchange can be promoted into a full
 * conversation in the main window.
 */
export function QuickAsk() {
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [errored, setErrored] = useState(false);
  const streamRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const expanded = question.length > 0;
  const modelId = useStore((s) => s.defaultModelId);

  // Grow/shrink the window to match content.
  useEffect(() => {
    if (!IS_TAURI) return;
    getCurrentWindow()
      .setSize(new LogicalSize(680, expanded ? 470 : 104))
      .catch(() => {});
  }, [expanded]);

  // Stream listeners — filtered to this window's active request.
  useEffect(() => {
    let active = true;
    const handles: UnlistenFn[] = [];
    Promise.all([
      onChunk((e) => {
        if (e.id === streamRef.current) setAnswer((a) => a + e.delta);
      }),
      onDone((e) => {
        if (e.id === streamRef.current) setBusy(false);
      }),
      onError((e) => {
        if (e.id === streamRef.current) {
          setBusy(false);
          setErrored(true);
          setAnswer((a) => a || e.message);
        }
      }),
    ]).then((fns) => {
      if (active) handles.push(...fns);
      else fns.forEach((f) => f());
    });
    return () => {
      active = false;
      handles.forEach((f) => f());
    };
  }, []);

  // Re-sync model/prompt from disk and focus the input each time we're shown.
  useEffect(() => {
    const onFocus = () => {
      void useStore.persist.rehydrate();
      inputRef.current?.focus();
    };
    window.addEventListener("focus", onFocus);
    onFocus();
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const hide = () => {
    if (IS_TAURI) void getCurrentWindow().hide();
  };

  const reset = () => {
    setQuery("");
    setQuestion("");
    setAnswer("");
    setErrored(false);
    setBusy(false);
    streamRef.current = null;
    inputRef.current?.focus();
  };

  const ask = async () => {
    const q = query.trim();
    if (!q || busy) return;
    const { model, provider } = resolveModel(useStore.getState().defaultModelId);
    const streamId = crypto.randomUUID();
    streamRef.current = streamId;
    setQuestion(q);
    setAnswer("");
    setErrored(false);
    setBusy(true);
    try {
      await sendMessage({
        streamId,
        provider: provider.id,
        format: provider.format,
        endpoint: provider.endpoint,
        requiresKey: !provider.keyless,
        model: model.apiName,
        system: useStore.getState().defaultSystemPrompt,
        messages: [{ role: "user", content: q, images: [] }],
      });
    } catch (e) {
      setBusy(false);
      setErrored(true);
      setAnswer(e instanceof Error ? e.message : String(e));
    }
  };

  const stop = () => {
    if (streamRef.current) void cancelStream(streamRef.current);
    setBusy(false);
  };

  const continueInOrion = async () => {
    await promoteToConversation({ question, answer });
    if (IS_TAURI) {
      const main = await WebviewWindow.getByLabel("main");
      await main?.show();
      await main?.unminimize();
      await main?.setFocus();
      hide();
    }
    reset();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  };

  return (
    <div className="qa">
      <div className="qa-bar">
        <SparkleIcon size={18} />
        <input
          ref={inputRef}
          value={query}
          placeholder="Quick ask Orion…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="qa-model">{getModel(modelId).label}</span>
        {busy ? (
          <button className="qa-go stop" title="Stop" onClick={stop}>
            <StopIcon size={15} />
          </button>
        ) : (
          <button
            className="qa-go"
            title="Ask"
            disabled={query.trim().length === 0}
            onClick={() => void ask()}
          >
            <ArrowRightIcon size={16} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="qa-panel">
          <div className="qa-question">{question}</div>
          <div className={`qa-answer msg-content ${errored ? "error" : ""}`}>
            {answer.length === 0 && busy ? (
              <div className="thinking">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <Markdown>{answer}</Markdown>
            )}
          </div>
          <div className="qa-actions">
            <button className="btn btn-ghost" onClick={reset}>
              New
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void continueInOrion()}
              disabled={busy || errored || answer.length === 0}
            >
              Continue in Orion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
