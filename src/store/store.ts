import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, ImageAttachment, Message } from "../types";
import { DEFAULT_MODEL_ID, resolveModel } from "../lib/models";
import { cancelStream, listOllamaModels, sendMessage } from "../lib/bridge";

interface StreamState {
  conversationId: string;
  streamId: string;
  messageId: string;
}

interface OrionStore {
  conversations: Conversation[];
  activeId: string | null;
  /** Model new conversations inherit. */
  defaultModelId: string;
  /** System prompt new conversations inherit. */
  defaultSystemPrompt: string;
  streaming: StreamState | null;
  /** Live list of models installed in local Ollama (not persisted). */
  ollamaModels: string[];

  refreshOllamaModels: () => Promise<void>;
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  /** Sets the model — for the active conversation, or the default if none. */
  setModel: (id: string) => void;
  setDefaultModel: (id: string) => void;
  setDefaultSystemPrompt: (prompt: string) => void;
  setConversationSystemPrompt: (prompt: string) => void;

  send: (text: string, attachments?: ImageAttachment[]) => Promise<void>;
  /** Re-runs the active conversation's last assistant turn. */
  regenerate: () => Promise<void>;
  stop: () => Promise<void>;
  importConversation: (question: string, answer: string) => void;

  // Internal — invoked by the global stream-event listeners.
  pushDelta: (streamId: string, delta: string) => void;
  recordUsage: (streamId: string, input: number, output: number) => void;
  endStream: (streamId: string) => void;
  failStream: (streamId: string, message: string) => void;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are Orion, a sharp and concise desktop AI assistant. " +
  "Be direct, practical, and well-organized. Use markdown when it aids clarity.";

function deriveTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  if (!firstLine) return "Image analysis";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

/** Resolves the model for `conv`, builds the wire history (dropping the
 *  trailing assistant turn and any failed turns), and starts the stream. */
async function dispatchStream(
  conv: Conversation,
  assistantMsgId: string,
  streamId: string,
  defaultModelId: string,
  defaultSystemPrompt: string,
  onError: (message: string) => void,
): Promise<void> {
  const { model, provider } = resolveModel(conv.modelId ?? defaultModelId);
  const history = conv.messages
    .filter((m) => m.id !== assistantMsgId && !m.error)
    .map((m) => ({
      role: m.role,
      content: m.content,
      images: (m.attachments ?? []).map((a) => ({ mime: a.mime, data: a.data })),
    }));

  try {
    await sendMessage({
      streamId,
      provider: provider.id,
      format: provider.format,
      endpoint: provider.endpoint,
      requiresKey: !provider.keyless,
      model: model.apiName,
      system: conv.systemPrompt ?? defaultSystemPrompt,
      messages: history,
    });
  } catch (e) {
    onError(e instanceof Error ? e.message : String(e));
  }
}

function freshConversation(modelId: string, systemPrompt: string): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    modelId,
    systemPrompt,
    createdAt: now,
    updatedAt: now,
  };
}

export const useStore = create<OrionStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      defaultModelId: DEFAULT_MODEL_ID,
      defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      streaming: null,
      ollamaModels: [],

      refreshOllamaModels: async () => {
        try {
          set({ ollamaModels: await listOllamaModels() });
        } catch {
          set({ ollamaModels: [] });
        }
      },

      newConversation: () => {
        const conv = freshConversation(
          get().defaultModelId,
          get().defaultSystemPrompt,
        );
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: conv.id,
        }));
        return conv.id;
      },

      selectConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const activeId =
            s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId;
          return { conversations, activeId };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || c.title } : c,
          ),
        })),

      setModel: (id) =>
        set((s) => {
          if (!s.activeId) return { defaultModelId: id };
          return {
            conversations: s.conversations.map((c) =>
              c.id === s.activeId ? { ...c, modelId: id } : c,
            ),
          };
        }),

      setDefaultModel: (id) => set({ defaultModelId: id }),
      setDefaultSystemPrompt: (prompt) => set({ defaultSystemPrompt: prompt }),

      setConversationSystemPrompt: (prompt) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId ? { ...c, systemPrompt: prompt } : c,
          ),
        })),

      send: async (raw, attachments) => {
        const text = raw.trim();
        const images = attachments ?? [];
        if ((!text && images.length === 0) || get().streaming) return;

        let convId = get().activeId;
        if (!convId || !get().conversations.some((c) => c.id === convId)) {
          convId = get().newConversation();
        }

        const now = Date.now();
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          attachments: images.length > 0 ? images : undefined,
          createdAt: now,
        };
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          createdAt: now + 1,
        };
        const streamId = crypto.randomUUID();

        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c;
            return {
              ...c,
              title: c.messages.length === 0 ? deriveTitle(text) : c.title,
              messages: [...c.messages, userMsg, assistantMsg],
              updatedAt: now,
            };
          }),
          streaming: { conversationId: convId!, streamId, messageId: assistantMsg.id },
        }));

        const conv = get().conversations.find((c) => c.id === convId)!;
        await dispatchStream(
          conv,
          assistantMsg.id,
          streamId,
          get().defaultModelId,
          get().defaultSystemPrompt,
          (m) => get().failStream(streamId, m),
        );
      },

      regenerate: async () => {
        if (get().streaming) return;
        const convId = get().activeId;
        const conv = get().conversations.find((c) => c.id === convId);
        if (!conv || conv.messages.length === 0) return;
        if (conv.messages[conv.messages.length - 1].role !== "assistant") return;

        const now = Date.now();
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          createdAt: now,
        };
        const streamId = crypto.randomUUID();

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages.slice(0, -1), assistantMsg],
                  updatedAt: now,
                }
              : c,
          ),
          streaming: {
            conversationId: convId!,
            streamId,
            messageId: assistantMsg.id,
          },
        }));

        const updated = get().conversations.find((c) => c.id === convId)!;
        await dispatchStream(
          updated,
          assistantMsg.id,
          streamId,
          get().defaultModelId,
          get().defaultSystemPrompt,
          (m) => get().failStream(streamId, m),
        );
      },

      stop: async () => {
        const stream = get().streaming;
        if (!stream) return;
        await cancelStream(stream.streamId);
        get().endStream(stream.streamId);
      },

      importConversation: (question, answer) => {
        const now = Date.now();
        const conv: Conversation = {
          id: crypto.randomUUID(),
          title: deriveTitle(question),
          modelId: get().defaultModelId,
          systemPrompt: get().defaultSystemPrompt,
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: question,
              createdAt: now,
            },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: answer,
              createdAt: now + 1,
            },
          ],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: conv.id,
        }));
      },

      pushDelta: (streamId, delta) => {
        const stream = get().streaming;
        if (!stream || stream.streamId !== streamId) return;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === stream.conversationId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === stream.messageId
                      ? { ...m, content: m.content + delta }
                      : m,
                  ),
                }
              : c,
          ),
        }));
      },

      recordUsage: (streamId, input, output) => {
        const stream = get().streaming;
        if (!stream || stream.streamId !== streamId) return;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === stream.conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === stream.messageId
                      ? { ...m, usage: { input, output } }
                      : m,
                  ),
                }
              : c,
          ),
        }));
      },

      endStream: (streamId) => {
        const stream = get().streaming;
        if (!stream || stream.streamId !== streamId) return;
        set({ streaming: null });
      },

      failStream: (streamId, message) => {
        const stream = get().streaming;
        if (!stream || stream.streamId !== streamId) return;
        set((s) => ({
          streaming: null,
          conversations: s.conversations.map((c) =>
            c.id === stream.conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === stream.messageId
                      ? {
                          ...m,
                          error: true,
                          content:
                            m.content.trim().length > 0
                              ? m.content
                              : `**Couldn't complete the response.**\n\n${message}`,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        }));
      },
    }),
    {
      name: "orion-store",
      version: 1,
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        defaultModelId: s.defaultModelId,
        defaultSystemPrompt: s.defaultSystemPrompt,
      }),
    },
  ),
);
