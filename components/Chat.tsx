"use client";

import { useState, useRef, useEffect } from "react";
import { sendMessage, getLLMConfig, setLLMProvider } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string; timestamp: Date };

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const AssistantIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="8.5" cy="16" r="1" />
    <circle cx="15.5" cy="16" r="1" />
    <path d="M8.5 7a3.5 3.5 0 0 1 7 0v4h-7V7z" />
  </svg>
);

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [useDocuments, setUseDocuments] = useState(true);
  const [llmProvider, setLlmProvider] = useState<string>("");
  const [providerChanging, setProviderChanging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLLMConfig().then((c) => setLlmProvider(c.provider));
  }, []);

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;
    setProviderChanging(true);
    try {
      const res = await setLLMProvider(value);
      setLlmProvider(res.provider);
    } catch {
      // revert on error
      getLLMConfig().then((c) => setLlmProvider(c.provider));
    } finally {
      setProviderChanging(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const now = new Date();
    setMessages((m) => [...m, { role: "user", content: text, timestamp: now }]);
    setLoading(true);
    try {
      const res = await sendMessage(text, sessionId, useDocuments);
      setSessionId(res.session_id);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, timestamp: new Date() }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--surface)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
          <input
            type="checkbox"
            checked={useDocuments}
            onChange={(e) => setUseDocuments(e.target.checked)}
          />
          Use uploaded documents
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
          <span style={{ color: "var(--text-muted)" }}>LLM:</span>
          <select
            value={llmProvider || ""}
            onChange={handleProviderChange}
            disabled={providerChanging}
            style={{
              padding: "0.35rem 0.5rem",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              fontSize: "0.875rem",
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="bytez">Bytez</option>
            <option value="local">Local (Ollama)</option>
          </select>
        </label>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Ask a question. Upload documents first to get answers from your files.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              maxWidth: "85%",
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: msg.role === "user" ? "var(--accent)" : "var(--border)",
                  color: msg.role === "user" ? "white" : "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {msg.role === "user" ? <UserIcon /> : <AssistantIcon />}
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {msg.role === "user" ? "You" : "Assistant"}
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "12px",
                background: msg.role === "user" ? "var(--accent)" : "var(--bg)",
                border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                marginLeft: msg.role === "assistant" ? "40px" : "0",
                marginRight: msg.role === "user" ? "40px" : "0",
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          padding: "1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={loading}
          style={{
            flex: 1,
            padding: "0.6rem 1rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.6rem 1.25rem",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
