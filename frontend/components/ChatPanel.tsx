"use client";

import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface Props {
  onTradeComplete: () => void;
}

export default function ChatPanel({ onTradeComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Finance Ally. Ask me to analyze your portfolio, suggest trades, or execute orders directly.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await sendChat(msg);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: resp.message,
        actions: resp.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (resp.actions.trades.length > 0 || resp.actions.watchlist_changes.length > 0) {
        onTradeComplete();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Error — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={[
                "max-w-[90%] rounded px-3 py-2 text-xs font-mono leading-relaxed",
                msg.role === "user"
                  ? "bg-purple/30 border border-purple/40 text-text"
                  : "bg-surface-2 border border-border text-text",
              ].join(" ")}
            >
              {msg.content}
            </div>

            {/* Action chips */}
            {msg.actions && (
              <div className="flex flex-wrap gap-1 max-w-[90%]">
                {msg.actions.trades.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue/20 border border-blue/30 rounded text-[10px] font-mono text-blue">
                    {t.side.toUpperCase()} {t.quantity} {t.ticker} @ ${t.price.toFixed(2)}
                  </span>
                ))}
                {msg.actions.trade_errors.map((e, i) => (
                  <span key={i} className="px-2 py-0.5 bg-down/20 border border-down/30 rounded text-[10px] font-mono text-down">
                    ✗ {e}
                  </span>
                ))}
                {msg.actions.watchlist_changes.map((w, i) => (
                  <span key={i} className="px-2 py-0.5 bg-accent/20 border border-accent/30 rounded text-[10px] font-mono text-accent">
                    {w.action === "add" ? "+" : "−"} {w.ticker}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="bg-surface-2 border border-border rounded px-3 py-2">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-text-dim animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Finance Ally..."
          disabled={loading}
          className="flex-1 bg-bg border border-border rounded px-3 py-1.5 text-xs font-mono text-text placeholder-text-dim focus:outline-none focus:border-purple disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-3 py-1.5 bg-purple/30 border border-purple/50 rounded text-xs font-mono text-purple hover:bg-purple/40 disabled:opacity-40 transition-colors"
        >
          SEND
        </button>
      </form>
    </div>
  );
}
