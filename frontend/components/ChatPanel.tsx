"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChatMessages, sendChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

interface Props {
  onTradeComplete: () => void;
}

const SLASH_COMMANDS = [
  { cmd: "/analyze", desc: "portfolio breakdown" },
  { cmd: "/rebalance", desc: "suggest trades" },
  { cmd: "/risk", desc: "risk assessment" },
] as const;

function expandSlashCommand(input: string): string {
  switch (input.trim().toLowerCase()) {
    case "/analyze":
      return "Analyze my portfolio in detail — show risk concentration, P&L by position, and key observations.";
    case "/rebalance":
      return "Suggest a specific rebalancing plan for my portfolio with trade recommendations and reasoning.";
    case "/risk":
      return "Give me a risk assessment of my current portfolio — concentration, volatility exposure, and suggestions to reduce risk.";
    default:
      return input;
  }
}

function Timestamp() {
  return (
    <span className="text-[8px] font-mono text-text-dim/50 tabular-nums">
      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
    </span>
  );
}

export default function ChatPanel({ onTradeComplete }: Props) {
  const [messages, setMessages] = useState<(ChatMessage & { ts?: string })[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm Finance Ally — your AI trading assistant.\n\nAsk me to analyze your portfolio, suggest trades based on your risk profile, or execute orders directly. I can also manage your watchlist.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSeenTsRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);

  // Keep loadingRef in sync to avoid stale closure in the poll interval
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 5s polling for new messages (proactive alerts from the backend)
  useEffect(() => {
    async function poll() {
      if (loadingRef.current) return;
      try {
        const msgs = await fetchChatMessages(lastSeenTsRef.current);
        if (msgs.length === 0) return;
        lastSeenTsRef.current = msgs[msgs.length - 1].created_at;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = msgs
            .filter((m) => !existingIds.has(m.id))
            .map((m) => ({
              ...m,
              ts: m.created_at
                ? new Date(m.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : undefined,
            }));
          return newMsgs.length === 0 ? prev : [...prev, ...newMsgs];
        });
      } catch {
        // swallow poll errors silently
      }
    }

    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || loading) return;

    const expanded = expandSlashCommand(msg);
    const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user" as const, content: msg, ts }]);
    setInput("");
    setLoading(true);

    try {
      const resp = await sendChat(expanded);
      const rts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: resp.message,
          actions: resp.actions,
          ts: rts,
        },
      ]);
      if (resp.actions.trades.length > 0 || resp.actions.watchlist_changes.length > 0) {
        onTradeComplete();
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Connection error — please try again.",
          ts: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const trimmedInput = input.trim().toLowerCase();
  const showHints = trimmedInput.startsWith("/");
  const filteredCmds = showHints ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(trimmedInput)) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {/* Meta row */}
            <div className={`flex items-center gap-2 px-0.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <span
                className={`text-[9px] font-mono font-semibold uppercase tracking-widest ${
                  msg.role === "user" ? "text-purple/80" : "text-blue/80"
                }`}
              >
                {msg.role === "user" ? "You" : "Finance Ally"}
              </span>
              {msg.ts && <span className="text-[8px] font-mono text-text-dim/40 tabular-nums">{msg.ts}</span>}
              {msg.actions?.proactive && (
                <span className="px-1.5 py-0.5 bg-accent/15 border border-accent/30 rounded text-[8px] font-mono font-semibold uppercase tracking-widest text-accent">
                  Market Alert
                </span>
              )}
            </div>

            {/* Bubble */}
            <div
              className={[
                "max-w-[93%] rounded-xl px-3 py-2 text-[11px] font-mono leading-[1.6] whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-purple/20 border border-purple/30 text-text rounded-tr-sm"
                  : "bg-surface-2 border border-border/70 border-l-[2px] border-l-blue/50 text-text rounded-tl-sm",
              ].join(" ")}
            >
              {msg.content}
            </div>

            {/* Action chips */}
            {msg.actions &&
              (msg.actions.trades.length > 0 ||
                msg.actions.trade_errors.length > 0 ||
                msg.actions.watchlist_changes.length > 0) && (
                <div className="flex flex-wrap gap-1 max-w-[93%] pl-1">
                  {msg.actions.trades.map((t, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-up/10 border border-up/25 rounded-full text-[9px] font-mono font-semibold text-up"
                    >
                      <span className="opacity-60">✓</span>
                      {t.side.toUpperCase()} {t.quantity} {t.ticker} @ ${t.price.toFixed(2)}
                    </span>
                  ))}
                  {msg.actions.trade_errors.map((e, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-down/10 border border-down/25 rounded-full text-[9px] font-mono text-down"
                    >
                      ✗ {e}
                    </span>
                  ))}
                  {msg.actions.watchlist_changes.map((w, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/25 rounded-full text-[9px] font-mono font-semibold text-accent"
                    >
                      {w.action === "add" ? "+" : "−"} {w.ticker}
                    </span>
                  ))}
                </div>
              )}
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-blue/80">Finance Ally</span>
              <Timestamp />
            </div>
            <div className="bg-surface-2 border border-border/70 border-l-[2px] border-l-blue/50 rounded-xl rounded-tl-sm px-3 py-2.5">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue/50 animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Slash-command hint dropdown */}
      {showHints && filteredCmds.length > 0 && (
        <div className="mx-3 mb-1 border border-border rounded-lg bg-surface-2 overflow-hidden">
          {filteredCmds.map(({ cmd, desc }) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                setInput(cmd);
                inputRef.current?.focus();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-blue/10 transition-colors text-left"
            >
              <span className="text-[10px] font-mono font-semibold text-blue">{cmd}</span>
              <span className="text-[9px] font-mono text-text-dim/60">{desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-3 py-2.5 shrink-0 bg-surface">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Finance Ally…"
            disabled={loading}
            className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-[11px] font-mono text-text placeholder-text-dim/60 focus:outline-none focus:border-purple/50 focus:bg-surface disabled:opacity-40 transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-8 h-8 flex items-center justify-center bg-purple/25 border border-purple/50 rounded-lg text-purple hover:bg-purple/35 disabled:opacity-30 transition-colors shrink-0"
            aria-label="Send message"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 10V2M2 6l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-[8px] font-mono text-text-dim/30 mt-1.5 text-center tracking-wide">
          Enter to send · AI can execute trades automatically
        </p>
      </div>
    </div>
  );
}
