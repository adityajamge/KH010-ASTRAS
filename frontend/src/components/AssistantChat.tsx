import { useEffect, useRef, useState, type FormEvent } from "react";
import { WaterDropLogo } from "./AssistantFab";

interface ChatMessage {
  id: number;
  from: "user" | "assistant";
  text: string;
}

const EMPTY_MESSAGES: Record<string, string> = {
  Farmer: "Ask about your allocation, schedule, or why your water changed.",
  "Jal Vigyani": "Ask about canal flows, conflicts, or anomalies on your network.",
  "Dam Operator": "Ask about reservoir levels, releases, or supply planning.",
};

const STUB_REPLY =
  "The assistant isn't connected yet — chat answers will appear here once the language model is configured.";

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
    const reply: ChatMessage = { id: nextId + 1, from: "assistant", text: STUB_REPLY };
    setNextId(nextId + 2);
    setMessages((prev) => [...prev, userMsg, reply]);
    setDraft("");
  }

  return (
    <aside
      className={`assistant-chat${open ? " open" : ""}`}
      aria-label="Assistant chat"
      aria-hidden={!open}
    >
      <div className="assistant-chat-head">
        <div>
          <p className="eyebrow">JalSetu Assistant</p>
        </div>
        <button
          type="button"
          className="assistant-chat-close"
          aria-label="Close assistant chat"
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
            <p className="assistant-chat-empty-title">How can I help?</p>
            <p className="assistant-chat-empty-sub">
              {EMPTY_MESSAGES[roleLabel] ?? "Ask about your water status."}
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
          placeholder="Ask about your water…"
          aria-label="Chat message"
          onChange={(e) => setDraft(e.target.value)}
          tabIndex={open ? 0 : -1}
        />
        <button
          type="submit"
          className="assistant-chat-send"
          aria-label="Send message"
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
