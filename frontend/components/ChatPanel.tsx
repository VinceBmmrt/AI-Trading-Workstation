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
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Connection error — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {/* Role label */}
            <span className={`text-[9px] font-mono uppercase tracking-widest px-0.5 ${
              msg.role === "user" ? "text-purple/70" : "text-blue/70"
            }`}>
              {msg.role === "user" ? "You" : "Finance Ally"}
            </span>

            {/* Bubble */}
            <div
              className={[
                "max-w-[92%] rounded-lg px-3 py-2 text-[11px] font-mono leading-relaxed",
                msg.role === "user"
                  ? "bg-purple/20 border border-purple/35 text-text rounded-tr-sm"
                  : "bg-surface-2 border border-border border-l-2 border-l-blue/60 text-text rounded-tl-sm",
              ].join(" ")}
            >
              {msg.content}
            </div>

            {/* Action chips */}
            {msg.actions && (
              <div className="flex flex-wrap gap-1 max-w-[92%]">
                {msg.actions.trades.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue/10 border border-blue/25 rounded-full text-[10px] font-mono text-blue">
                    <span className="opacity-60">✓</span>
                    {t.side.toUpperCase()} {t.quantity} {t.ticker} @ ${t.price.toFixed(2)}
                  </span>
                ))}
                {msg.actions.trade_errors.map((e, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-down/10 border border-down/25 rounded-full text-[10px] font-mono text-down">
                    <span>✗</span> {e}
                  </span>
                ))}
                {msg.actions.watchlist_changes.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/25 rounded-full text-[10px] font-mono text-accent">
                    {w.action === "add" ? "+" : "−"} {w.ticker}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-[9px] font-mono uppercase tracking-widest text-blue/70 px-0.5">Finance Ally</span>
            <div className="bg-surface-2 border border-border border-l-2 border-l-blue/60 rounded-lg rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue/60 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Finance Ally…"
            disabled={loading}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-[11px] font-mono text-text placeholder-text-dim focus:outline-none focus:border-purple/60 focus:bg-surface disabled:opacity-40 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-purple/25 border border-purple/50 rounded-lg text-xs font-mono font-semibold text-purple hover:bg-purple/35 disabled:opacity-30 transition-colors"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
