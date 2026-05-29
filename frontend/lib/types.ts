export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
  timestamp: number;
}

export interface WatchlistItem {
  ticker: string;
  price: number | null;
  change_percent: number | null;
  direction: "up" | "down" | "flat" | null;
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  positions: Position[];
  holdings_value: number;
  total_value: number;
}

export interface HistoryPoint {
  total_value: number;
  recorded_at: string;
}

export interface TradeResult {
  success: boolean;
  trade: {
    id: string;
    ticker: string;
    side: string;
    quantity: number;
    price: number;
    executed_at: string;
  };
  portfolio: Portfolio;
}

export interface ChatActions {
  trades: TradeResult["trade"][];
  trade_errors: string[];
  watchlist_changes: { ticker: string; action: string }[];
  proactive?: boolean;
  ticker?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatActions;
  created_at?: string;
}

export interface MarketSummary {
  summary: string;
  generated_at: string;
}

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export interface TradeRecord {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  executed_at: string;
}

export interface PortfolioAnalytics {
  total_trades: number;
  total_invested: number;
  total_received: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_return_pct: number;
  best_performer: string | null;
  worst_performer: string | null;
  win_rate: number;
  buy_count: number;
  sell_count: number;
}

export interface Alert {
  id: number;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  active: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface FiredAlert {
  id: number;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  current_price: number;
  triggered_at: string;
}
