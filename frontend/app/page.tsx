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
import StatusBar from "@/components/StatusBar";
import TradeHistory from "@/components/TradeHistory";
import PortfolioAnalyticsPanel from "@/components/PortfolioAnalyticsPanel";
import MarketSummaryBanner from "@/components/MarketSummaryBanner";
import SettingsPanel from "@/components/SettingsPanel";
import { useMarketData } from "@/hooks/useMarketData";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAlerts } from "@/hooks/useAlerts";
import { useTheme } from "@/hooks/useTheme";
import ToastContainer from "@/components/ToastContainer";
import { fetchWatchlist, fetchSettings } from "@/lib/api";

const DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];

type PortfolioTab = "positions" | "heatmap" | "pnl" | "history" | "analytics";
type MobilePanel = "watchlist" | "chart" | "chat";

const TAB_LABELS: Record<PortfolioTab, string> = {
  positions: "Positions",
  heatmap: "Heatmap",
  pnl: "P&L",
  history: "History",
  analytics: "Analytics",
};

const MOBILE_TABS: { id: MobilePanel; label: string; icon: string }[] = [
  { id: "watchlist", label: "Watchlist", icon: "☰" },
  { id: "chart",     label: "Chart",     icon: "◈" },
  { id: "chat",      label: "AI Chat",   icon: "◉" },
];

export default function TradingPage() {
  const { alerts, toasts, handleAlertFired, dismissToast, createAlert } = useAlerts();
  const market = useMarketData({ onAlertFired: handleAlertFired });
  const { portfolio, history, trades, analytics, refresh: refreshPortfolio } = usePortfolio();

  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [selectedTicker, setSelectedTicker] = useState(() => {
    if (typeof window === "undefined") return "AAPL";
    return localStorage.getItem("fa_selected_ticker") ?? "AAPL";
  });
  const [chatOpen, setChatOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("fa_chat_open") !== "false";
  });
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>(() => {
    if (typeof window === "undefined") return "positions";
    return (localStorage.getItem("fa_portfolio_tab") as PortfolioTab) ?? "positions";
  });
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(() => {
    if (typeof window === "undefined") return "chart";
    return (localStorage.getItem("fa_mobile_panel") as MobilePanel) ?? "chart";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startingCapital, setStartingCapital] = useState(10000);
  const { theme } = useTheme();

  // Desktop: collapse chat when viewport is too narrow (only closes, never force-opens)
  useEffect(() => {
    const BREAKPOINT = 1100;
    function check() { if (window.innerWidth < BREAKPOINT) setChatOpen(false); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetchWatchlist()
      .then((items) => { if (items.length > 0) setTickers(items.map((i) => i.ticker)); })
      .catch(() => {});
  }, []);

  useEffect(() => { localStorage.setItem("fa_selected_ticker", selectedTicker); }, [selectedTicker]);
  useEffect(() => { localStorage.setItem("fa_chat_open", String(chatOpen)); }, [chatOpen]);
  useEffect(() => { localStorage.setItem("fa_portfolio_tab", portfolioTab); }, [portfolioTab]);
  useEffect(() => { localStorage.setItem("fa_mobile_panel", mobilePanel); }, [mobilePanel]);

  useEffect(() => {
    fetchSettings().then(s => setStartingCapital(s.starting_capital)).catch(() => {});
  }, []);

  function refreshWatchlist() {
    fetchWatchlist()
      .then((items) => { if (items.length > 0) setTickers(items.map((i) => i.ticker)); })
      .catch(() => {});
  }

  // When user picks a ticker on mobile watchlist, jump to chart
  function handleMobileTicker(ticker: string) {
    setSelectedTicker(ticker);
    setMobilePanel("chart");
  }

  const priceCount = market.prices.size;

  // Shared watchlist + tradebar content (used in both desktop aside and mobile panel)
  const watchlistContent = (
    <>
      <div className="px-3 py-1.5 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Watchlist</span>
        <span className="text-[9px] font-mono text-text-dim/40 tabular-nums">{tickers.length}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <WatchlistPanel
          tickers={tickers}
          prices={market.prices}
          history={market.history}
          flashing={market.flashing}
          selectedTicker={selectedTicker}
          onSelectTicker={(t) => { setSelectedTicker(t); setMobilePanel("chart"); }}
          onWatchlistChange={refreshWatchlist}
          alerts={alerts}
          onCreateAlert={createAlert}
        />
      </div>
      <TradeBar
        selectedTicker={selectedTicker}
        prices={market.prices}
        onTradeComplete={refreshPortfolio}
      />
    </>
  );

  // Shared chart + portfolio content
  const chartContent = (
    <>
      <div className="flex-[3] min-h-0 border-b border-border overflow-hidden">
        <PriceChart
          ticker={selectedTicker}
          prices={market.prices}
          history={market.history}
          volumeHistory={market.volumeHistory}
        />
      </div>
      <div className="flex-[2] min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center border-b border-border shrink-0 px-1 bg-surface overflow-x-auto">
          {(["positions", "heatmap", "pnl", "history", "analytics"] as PortfolioTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setPortfolioTab(tab)}
              className={`shrink-0 px-4 py-2 text-[10px] font-mono uppercase tracking-widest cursor-pointer border-b-2 transition-all ${
                portfolioTab === tab
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-text-dim hover:text-text hover:border-border"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
          {portfolio && (
            <div className="ml-auto shrink-0 flex items-center gap-3 pr-3 text-[9px] font-mono text-text-dim uppercase tracking-widest">
              <span>{portfolio.positions.length} pos</span>
              <span className="text-border/40">│</span>
              <span>${portfolio.holdings_value.toLocaleString("en-US", { maximumFractionDigits: 0 })} invested</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {portfolioTab === "positions"  && <PositionsTable portfolio={portfolio} />}
          {portfolioTab === "heatmap"    && <PortfolioHeatmap portfolio={portfolio} />}
          {portfolioTab === "pnl"        && <PnLChart history={history} />}
          {portfolioTab === "history"    && <TradeHistory trades={trades} />}
          {portfolioTab === "analytics"  && <PortfolioAnalyticsPanel analytics={analytics} />}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header
        portfolio={portfolio}
        status={market.status}
        startingCapital={startingCapital}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <MarketSummaryBanner />

      {/* ── MOBILE layout (<md = 768px) ── */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden md:hidden">
        {mobilePanel === "watchlist" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {watchlistContent}
          </div>
        )}
        {mobilePanel === "chart" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {chartContent}
          </div>
        )}
        {mobilePanel === "chat" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ChatPanel onTradeComplete={refreshPortfolio} />
          </div>
        )}

        {/* Mobile bottom tab bar */}
        <nav className="flex shrink-0 border-t border-border bg-surface">
          {MOBILE_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setMobilePanel(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[9px] font-mono uppercase tracking-widest transition-colors ${
                mobilePanel === id
                  ? "text-accent border-t-2 border-accent -mt-px"
                  : "text-text-dim hover:text-text border-t-2 border-transparent -mt-px"
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── DESKTOP layout (≥md = 768px) ── */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT — Watchlist + Trade Bar */}
        <aside className="w-56 flex flex-col border-r border-border shrink-0 min-h-0">
          {watchlistContent}
        </aside>

        {/* CENTER — Chart + Portfolio */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {chartContent}
        </main>

        {/* RIGHT — Chat panel (collapsible) */}
        <aside
          className={`flex flex-col border-l border-border shrink-0 min-h-0 transition-all duration-200 ${
            chatOpen ? "w-72" : "w-8"
          }`}
        >
          <button
            onClick={() => setChatOpen((o) => !o)}
            className={`h-11 border-b border-border flex items-center shrink-0 transition-colors hover:bg-surface-2 ${
              chatOpen ? "justify-between px-3" : "justify-center"
            }`}
          >
            {chatOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue/80 shadow-[0_0_4px_rgba(32,157,215,0.8)]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">AI Chat</span>
                </div>
                <span className="text-text-dim/50 text-base leading-none">×</span>
              </>
            ) : (
              <span className="text-[8px] font-mono text-text-dim/50 uppercase tracking-widest"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
                AI
              </span>
            )}
          </button>
          {chatOpen && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel onTradeComplete={refreshPortfolio} />
            </div>
          )}
        </aside>
      </div>

      {/* Bottom status bar */}
      <StatusBar status={market.status} priceCount={priceCount} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          onResetComplete={() => {
            refreshPortfolio();
            fetchSettings().then(s => setStartingCapital(s.starting_capital)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
