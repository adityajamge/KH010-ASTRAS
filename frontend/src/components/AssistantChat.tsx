import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/clerk-react";
import { WaterDropLogo } from "./AssistantFab";
import { useLanguage } from "../lib/i18n";
import { ApiError, getAssistantHistory, sendAssistantMessage } from "../lib/api";

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

/** Renders `**bold**` segments within one line as <strong>. */
function renderInlineBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

/** Minimal markdown: `# heading` / `- list` lines and inline `**bold**`. */
function renderMarkdownLite(text: string) {
  return text.split("\n").map((line, i) => {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      return (
        <div key={i} className="assistant-msg-heading">
          {renderInlineBold(heading[1])}
        </div>
      );
    }
    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      return (
        <div key={i} className="assistant-msg-li">
          <span className="assistant-msg-li-dot" aria-hidden="true" />
          <span>{renderInlineBold(listItem[1])}</span>
        </div>
      );
    }
    return <div key={i}>{renderInlineBold(line)}</div>;
  });
}

/**
 * Right-side assistant chat panel. Slides in when the water-drop logo is
 * clicked. Talks to POST /api/v1/assistant/message — the same AI
 * Coordinator, allocation engine, and mediation workflow the Twilio channel
 * uses (backend/app/services/ai_coordinator.py), with replies following the
 * dashboard's selected language.
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
  const [historyLoaded, setHistoryLoaded] = useState(false);
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
  }, [messages, open, sending]);

  // Load prior website-chat turns once, the first time the panel opens.
  useEffect(() => {
    if (!open || historyLoaded) return;
    setHistoryLoaded(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const history = await getAssistantHistory(token);
        setMessages((prev) => {
          if (prev.length > 0) return prev;
          let id = 1;
          return history.map((item) => ({
            id: id++,
            from: item.role === "user" ? "user" : "assistant",
            text: item.content,
          }));
        });
        setNextId((id) => Math.max(id, history.length + 1));
      } catch {
        // History is a convenience — a failed load just leaves the panel empty.
      }
    })();
  }, [open, historyLoaded, getToken]);

  // Claude tends to keep matching the conversation's existing language even
  // when told (via the system prompt) to switch — so a language change
  // starts a fresh conversation instead of sending mixed-language history.
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current !== lang) {
      prevLangRef.current = lang;
      setMessages([]);
    }
  }, [lang]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { id: nextId, from: "user", text };
    setNextId((id) => id + 1);
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);
    try {
      const token = await getToken();
      if (!token) throw new ApiError(401, t("Could not verify your session."));
      const { reply } = await sendAssistantMessage(token, text, lang);
      setMessages((prev) => [...prev, { id: userMsg.id + 1, from: "assistant", text: reply }]);
      setNextId((id) => Math.max(id, userMsg.id + 2));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("assistant chat failed:", err);
      const errText =
        err instanceof ApiError ? err.message : t("Something went wrong. Please try again.");
      setMessages((prev) => [...prev, { id: userMsg.id + 1, from: "assistant", text: errText }]);
      setNextId((id) => Math.max(id, userMsg.id + 2));
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
                <div className="assistant-msg-body">{renderMarkdownLite(msg.text)}</div>
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
