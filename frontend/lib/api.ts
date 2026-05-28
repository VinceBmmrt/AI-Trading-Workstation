import type { Portfolio, HistoryPoint, WatchlistItem, TradeResult, TradeRecord, PortfolioAnalytics, MarketSummary, ChatMessage } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";  // empty = same-origin in production

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const r = await fetch(`${BASE}/api/watchlist`);
  if (!r.ok) throw new Error("Failed to fetch watchlist");
  return r.json();
}

export async function addToWatchlist(ticker: string): Promise<void> {
  const r = await fetch(`${BASE}/api/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail ?? "Failed to add ticker");
  }
}

export async function removeFromWatchlist(ticker: string): Promise<void> {
  const r = await fetch(`${BASE}/api/watchlist/${ticker}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to remove ticker");
}

export async function fetchPortfolio(): Promise<Portfolio> {
  const r = await fetch(`${BASE}/api/portfolio`);
  if (!r.ok) throw new Error("Failed to fetch portfolio");
  return r.json();
}

export async function fetchHistory(): Promise<HistoryPoint[]> {
  const r = await fetch(`${BASE}/api/portfolio/history`);
  if (!r.ok) throw new Error("Failed to fetch history");
  return r.json();
}

export async function executeTrade(
  ticker: string,
  quantity: number,
  side: "buy" | "sell"
): Promise<TradeResult> {
  const r = await fetch(`${BASE}/api/portfolio/trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, quantity, side }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail ?? "Trade failed");
  return data;
}

export async function fetchTrades(): Promise<TradeRecord[]> {
  const r = await fetch(`${BASE}/api/portfolio/trades`);
  if (!r.ok) throw new Error("Failed to fetch trades");
  return r.json();
}

export async function fetchAnalytics(): Promise<PortfolioAnalytics> {
  const r = await fetch(`${BASE}/api/portfolio/analytics`);
  if (!r.ok) throw new Error("Failed to fetch analytics");
  return r.json();
}

export async function fetchMarketSummary(): Promise<MarketSummary> {
  const r = await fetch(`${BASE}/api/chat/market-summary`);
  if (!r.ok) throw new Error("Failed to fetch market summary");
  return r.json();
}

export async function fetchChatMessages(afterTs?: string): Promise<ChatMessage[]> {
  const url = afterTs
    ? `${BASE}/api/chat/messages?after_ts=${encodeURIComponent(afterTs)}`
    : `${BASE}/api/chat/messages`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch chat messages");
  return r.json();
}

export async function sendChat(
  message: string
): Promise<{ message: string; actions: import("./types").ChatActions }> {
  const r = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!r.ok) throw new Error("Chat request failed");
  return r.json();
}
