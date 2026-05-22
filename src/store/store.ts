import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Conversation, ImageAttachment, Message } from "../types";
import { DEFAULT_MODEL_ID, resolveModel } from "../lib/models";
import { cancelStream, sendMessage } from "../lib/bridge";

interface StreamState {
  conversationId: string;
  streamId: string;
  messageId: string;
}

interface OrionStore {
  conversations: Conversation[];
  activeId: string | null;
  modelId: string;
  systemPrompt: string;
  streaming: StreamState | null;

  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setModel: (id: string) => void;
  setSystemPrompt: (prompt: string) => void;

  send: (text: string, attachments?: ImageAttachment[]) => Promise<void>;
  stop: () => Promise<void>;
  importConversation: (question: string, answer: string) => void;

  // Internal — invoked by the global stream-event listeners.
  pushDelta: (streamId: string, delta: string) => void;
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

function freshConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export const useStore = create<OrionStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      streaming: null,

      newConversation: () => {
        const conv = freshConversation();
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

      setModel: (id) => set({ modelId: id }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),

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
        const { model, provider } = resolveModel(get().modelId);
        const history = conv.messages
          .filter((m) => m.id !== assistantMsg.id && !m.error)
          .map((m) => ({
            role: m.role,
            content: m.content,
            images: (m.attachments ?? []).map((a) => ({
              mime: a.mime,
              data: a.data,
            })),
          }));

        try {
          await sendMessage({
            streamId,
            provider: provider.id,
            format: provider.format,
            endpoint: provider.endpoint,
            model: model.apiName,
            system: get().systemPrompt,
            messages: history,
          });
        } catch (e) {
          get().failStream(streamId, e instanceof Error ? e.message : String(e));
        }
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
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        modelId: s.modelId,
        systemPrompt: s.systemPrompt,
      }),
    },
  ),
);
