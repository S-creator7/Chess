import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessageDto } from "@chess/api-client";

type Props = {
  messages: ChatMessageDto[];
  selfId: string;
  onSend: (body: string) => void;
  opponentName?: string;
  connected?: boolean;
};

const QUICK = ["Good luck", "Good game", "Thanks", "Well played"];

export function GameChat({ messages, selfId, onSend, opponentName, connected = true }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !connected) return;
    onSend(body);
    setDraft("");
  }

  return (
    <section className="chat-panel" aria-label="Game chat">
      <h3>
        Live chat{opponentName ? ` · ${opponentName}` : ""}
        <span className={`chat-conn ${connected ? "on" : "off"}`}>{connected ? "Live" : "Reconnecting…"}</span>
      </h3>
      <div className="chat-log">
        {messages.length === 0 && <p className="muted">Say hello. Chat uses the same WebSocket as moves.</p>}
        {messages.map((msg) => {
          const mine = msg.userId === selfId;
          return (
            <div key={msg.id} className={`chat-row ${mine ? "mine" : "theirs"}`}>
              <div className="chat-meta">{mine ? "You" : msg.displayName}</div>
              <div className="chat-bubble">{msg.body}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="chat-quick">
        {QUICK.map((text) => (
          <button key={text} type="button" className="secondary" disabled={!connected} onClick={() => onSend(text)}>
            {text}
          </button>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={draft}
          maxLength={240}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Chat message"
          disabled={!connected}
        />
        <button type="submit" disabled={!draft.trim() || !connected}>
          Send
        </button>
      </form>
    </section>
  );
}
