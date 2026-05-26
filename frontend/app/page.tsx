"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import WatchlistPanel from "@/components/WatchlistPanel";
import PriceChart from "@/components/PriceChart";
import PortfolioHeatmap from "@/components/PortfolioHeatmap";
import PositionsTable from "@/components/PositionsTable";
import PnLChart from "@/components/PnLChart";
import TradeBar from "@/components/TradeBar";
import ChatPanel from "@/components/ChatPanel";
import { useMarketData } from "@/hooks/useMarketData";
import { usePortfolio } from "@/hooks/usePortfolio";
import { fetchWatchlist } from "@/lib/api";

const DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];

type PortfolioTab = "positions" | "heatmap" | "pnl";

export default function TradingPage() {
  const market = useMarketData();
  const { portfolio, history, refresh: refreshPortfolio } = usePortfolio();

  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [chatOpen, setChatOpen] = useState(true);
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("positions");

  useEffect(() => {
    fetchWatchlist()
      .then((items) => { if (items.length > 0) setTickers(items.map((i) => i.ticker)); })
      .catch(() => {});
  }, []);

  function refreshWatchlist() {
    fetchWatchlist()
      .then((items) => { if (items.length > 0) setTickers(items.map((i) => i.ticker)); })
      .catch(() => {});
  }

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider cursor-pointer border-b-2 transition-colors ${
      active ? "border-accent text-accent" : "border-transparent text-text-dim hover:text-text"
    }`;

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header portfolio={portfolio} status={market.status} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Watchlist + Trade Bar */}
        <aside className="w-56 flex flex-col border-r border-border shrink-0 min-h-0">
          <div className="px-3 py-1.5 border-b border-border shrink-0">
            <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Watchlist</span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <WatchlistPanel
              tickers={tickers}
              prices={market.prices}
              history={market.history}
              flashing={market.flashing}
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
              onWatchlistChange={refreshWatchlist}
            />
          </div>
          <TradeBar selectedTicker={selectedTicker} onTradeComplete={refreshPortfolio} />
        </aside>

        {/* CENTER: Chart + Portfolio */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Price chart: 60% */}
          <div className="flex-[3] min-h-0 border-b border-border overflow-hidden">
            <PriceChart ticker={selectedTicker} prices={market.prices} history={market.history} />
          </div>

          {/* Portfolio panel: 40% */}
          <div className="flex-[2] min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-border shrink-0 px-1">
              {(["positions", "heatmap", "pnl"] as PortfolioTab[]).map((tab) => (
                <button key={tab} onClick={() => setPortfolioTab(tab)} className={tabCls(portfolioTab === tab)}>
                  {tab === "pnl" ? "P&L" : tab === "heatmap" ? "Heatmap" : "Positions"}
                </button>
              ))}
              {portfolio && (
                <span className="ml-auto text-[10px] font-mono text-text-dim pr-3">
                  {portfolio.positions.length} pos · ${portfolio.holdings_value.toFixed(0)} holdings
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {portfolioTab === "positions" && <PositionsTable portfolio={portfolio} />}
              {portfolioTab === "heatmap" && <PortfolioHeatmap portfolio={portfolio} />}
              {portfolioTab === "pnl" && <PnLChart history={history} />}
            </div>
          </div>
        </main>

        {/* RIGHT: Chat panel (collapsible) */}
        <aside
          className={`flex flex-col border-l border-border shrink-0 min-h-0 transition-all duration-200 ${
            chatOpen ? "w-72" : "w-9"
          }`}
        >
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="h-11 border-b border-border flex items-center justify-center text-text-dim hover:text-accent transition-colors shrink-0"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {chatOpen ? "AI Chat ×" : "AI"}
            </span>
          </button>
          {chatOpen && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel onTradeComplete={refreshPortfolio} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
