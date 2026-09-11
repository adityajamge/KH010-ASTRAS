import { useEffect, useRef, useState, type FormEvent } from "react";
import { WaterDropLogo } from "./AssistantFab";
import { useLanguage } from "../lib/i18n";

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
 * clicked. No LLM key yet: messages stay local and the assistant replies
 * with a not-connected notice.
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
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [nextId, setNextId] = useState(1);
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

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: nextId, from: "user", text };
    const reply: ChatMessage = {
      id: nextId + 1,
      from: "assistant",
      text: t(
        "The assistant isn't connected yet — chat answers will appear here once the language model is configured.",
      ),
    };
    setNextId(nextId + 2);
    setMessages((prev) => [...prev, userMsg, reply]);
    setDraft("");
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
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`assistant-msg${msg.from === "user" ? " user" : ""}`}
            >
              <p>{msg.text}</p>
            </div>
          ))
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
          tabIndex={open ? 0 : -1}
        />
        <button
          type="submit"
          className="assistant-chat-send"
          aria-label={t("Send message")}
          disabled={!draft.trim()}
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
