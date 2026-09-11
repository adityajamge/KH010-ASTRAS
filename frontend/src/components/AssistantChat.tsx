import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/clerk-react";
import { WaterDropLogo } from "./AssistantFab";
import { useLanguage } from "../lib/i18n";
import { ApiError, chatWithAssistant, type AssistantChatMessage } from "../lib/api";

interface ChatMessage {
  id: number;
  from: "user" | "assistant";
  text: string;
}

const EMPTY_MESSAGE_KEY: Record<string, string> = {
  Farmer: "Ask about your allocation, schedule, or why your water changed.",
  "Jal Vigyani": "Ask about canal flows, conflicts, or anomalies on your network.",
  "Dam Operator": "Ask about reservoir levels, releases, or supply planning.",
};

/**
 * Right-side assistant chat panel. Slides in when the water-drop logo is
 * clicked. Talks to the backend's LangGraph-orchestrated assistant; chat
 * history lives only in this component's state (no server-side memory —
 * each request resends the visible turns).
 */
export function AssistantChat({
  open,
  onClose,
  roleLabel,
}: {
  open: boolean;
  onClose: () => void;
  roleLabel: string;
}) {
  const { t, lang } = useLanguage();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [nextId, setNextId] = useState(1);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [open ]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const history: AssistantChatMessage[] = messages.map((m) => ({
      role: m.from,
      content: m.text,
    }));
    const userId = nextId;
    setMessages((prev) => [...prev, { id: userId, from: "user", text }]);
    setNextId(userId + 2);
    setDraft("");
    setSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error(t("Could not verify your session."));
      const { reply } = await chatWithAssistant(token, text, history, lang);
      setMessages((prev) => [...prev, { id: userId + 1, from: "assistant", text: reply }]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("assistant chat failed:", err);
      const errText = err instanceof ApiError ? err.message : t("Something went wrong. Please try again.");
      setMessages((prev) => [...prev, { id: userId + 1, from: "assistant", text: errText }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <aside
      className={`assistant-chat${open ? " open" : ""}`}
      aria-label={t("Assistant chat")}
      aria-hidden={!open}
    >
      <div className="assistant-chat-head">
        <div>
          <p className="eyebrow">{t("JalSetu Assistant")}</p>
        </div>
        <button
          type="button"
          className="assistant-chat-close"
          aria-label={t("Close assistant chat")}
          onClick={onClose}
          tabIndex={open ? 0 : -1}
        >
          ×
        </button>
      </div>

      <div className="assistant-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="assistant-chat-empty">
            <WaterDropLogo size={112} />
            <p className="assistant-chat-empty-title">{t("How can I help?")}</p>
            <p className="assistant-chat-empty-sub">
              {t(EMPTY_MESSAGE_KEY[roleLabel] ?? "Ask about your water status.")}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`assistant-msg${msg.from === "user" ? " user" : ""}`}
              >
                <p>{msg.text}</p>
              </div>
            ))}
            {sending && (
              <div className="assistant-msg" aria-live="polite">
                <p>{t("Thinking…")}</p>
              </div>
            )}
          </>
        )}
      </div>

      <form className="assistant-chat-form" onSubmit={handleSend}>
        <input
          ref={inputRef}
          className="assistant-chat-input"
          value={draft}
          placeholder={t("Ask about your water…")}
          aria-label={t("Chat message")}
          onChange={(e) => setDraft(e.target.value)}
          disabled={sending}
          tabIndex={open ? 0 : -1}
        />
        <button
          type="submit"
          className="assistant-chat-send"
          aria-label={t("Send message")}
          disabled={!draft.trim() || sending}
          tabIndex={open ? 0 : -1}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22 11 13 2 9 22 2Z" />
          </svg>
        </button>
      </form>
    </aside>
  );
}
