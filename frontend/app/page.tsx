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
import MarketBreadthBar from "@/components/MarketBreadthBar";
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
  const [selectedTicker, setSelectedTicker] = useState("AAPL");
  const [chatOpen, setChatOpen] = useState(true);
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("positions");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chart");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startingCapital, setStartingCapital] = useState(10000);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Restore persisted layout preferences after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    const savedTicker = localStorage.getItem("fa_selected_ticker");
    if (savedTicker) setSelectedTicker(savedTicker);
    const savedTab = localStorage.getItem("fa_portfolio_tab") as PortfolioTab | null;
    if (savedTab) setPortfolioTab(savedTab);
    const savedPanel = localStorage.getItem("fa_mobile_panel") as MobilePanel | null;
    if (savedPanel) setMobilePanel(savedPanel);

    const BREAKPOINT = 1100;
    const savedChat = localStorage.getItem("fa_chat_open");
    setChatOpen(savedChat !== "false" && window.innerWidth >= BREAKPOINT);

    function check() { if (window.innerWidth < BREAKPOINT) setChatOpen(false); }
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

  const priceCount = market.prices.size;

  // On desktop, P&L and Heatmap are always visible — fall back to positions if one was saved
  const desktopTab: "positions" | "history" | "analytics" =
    portfolioTab === "positions" || portfolioTab === "history" || portfolioTab === "analytics"
      ? portfolioTab
      : "positions";

  // Shared watchlist + tradebar content (used in both desktop aside and mobile panel)
  const watchlistContent = (
    <>
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
          {portfolioTab === "analytics"  && <PortfolioAnalyticsPanel analytics={analytics} portfolio={portfolio} />}
        </div>
      </div>
    </>
  );

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header
        portfolio={portfolio}
        status={market.status}
        startingCapital={startingCapital}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <MarketBreadthBar prices={market.prices} />
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
        <aside className="w-72 flex flex-col border-r border-border shrink-0 min-h-0">
          {watchlistContent}
        </aside>

        {/* CENTER — Chart + Portfolio (desktop split layout) */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Price chart — top 55% */}
          <div className="flex-[3] min-h-0 border-b border-border overflow-hidden">
            <PriceChart
              ticker={selectedTicker}
              prices={market.prices}
              history={market.history}
              volumeHistory={market.volumeHistory}
            />
          </div>

          {/* Bottom — P&L + Heatmap (left) | table tabs (right) */}
          <div className="flex-[2] min-h-0 flex overflow-hidden">

            {/* Left: P&L chart stacked over Heatmap — always visible */}
            <div className="w-72 flex flex-col border-r border-border shrink-0 min-h-0">
              <div className="px-3 py-1 border-b border-border-subtle shrink-0 bg-surface flex items-center justify-between">
                <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Portfolio P&L</span>
              </div>
              <div className="flex-1 min-h-0 border-b border-border overflow-hidden relative">
                <PnLChart history={history} />
              </div>
              <div className="px-3 py-1 border-b border-border-subtle shrink-0 bg-surface flex items-center justify-between">
                <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Holdings Map</span>
                {portfolio && (
                  <span className="text-[9px] font-mono text-text-dim/50 tabular-nums">
                    {portfolio.positions.length} pos
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden relative">
                <PortfolioHeatmap portfolio={portfolio} />
              </div>
            </div>

            {/* Right: table tabs */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              <div className="flex items-center border-b border-border shrink-0 px-1 bg-surface overflow-x-auto">
                {(["positions", "history", "analytics"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPortfolioTab(tab)}
                    className={`shrink-0 px-4 py-2 text-[10px] font-mono uppercase tracking-widest cursor-pointer border-b-2 transition-all ${
                      desktopTab === tab
                        ? "border-accent text-accent bg-accent/5"
                        : "border-transparent text-text-dim hover:text-text hover:border-border"
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
                {portfolio && (
                  <div className="ml-auto shrink-0 flex items-center gap-2 pr-3 text-[9px] font-mono text-text-dim uppercase tracking-widest">
                    <span>${portfolio.holdings_value.toLocaleString("en-US", { maximumFractionDigits: 0 })} invested</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {desktopTab === "positions"  && <PositionsTable portfolio={portfolio} />}
                {desktopTab === "history"    && <TradeHistory trades={trades} />}
                {desktopTab === "analytics"  && <PortfolioAnalyticsPanel analytics={analytics} portfolio={portfolio} />}
              </div>
            </div>

          </div>
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
