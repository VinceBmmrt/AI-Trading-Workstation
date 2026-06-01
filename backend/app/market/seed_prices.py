"""Seed prices and per-ticker parameters for the market simulator."""

# Realistic starting prices for the default watchlist (mid-2025)
SEED_PRICES: dict[str, float] = {
    # Tech - original
    "AAPL": 190.00,
    "GOOGL": 175.00,
    "MSFT": 420.00,
    "AMZN": 185.00,
    "TSLA": 250.00,
    "NVDA": 800.00,
    "META": 500.00,
    "NFLX": 600.00,
    # Tech - new
    "AMD": 175.00,
    "INTC": 20.00,
    "CRM": 315.00,
    "ORCL": 145.00,
    "SNOW": 185.00,
    "PLTR": 28.00,
    # Finance - original
    "JPM": 195.00,
    "V": 280.00,
    # Finance - new
    "GS": 545.00,
    "MS": 115.00,
    "BAC": 43.00,
    "BRK.B": 455.00,
    # Healthcare
    "JNJ": 155.00,
    "UNH": 530.00,
    "PFE": 28.00,
    "LLY": 820.00,
    # Energy
    "XOM": 110.00,
    "CVX": 155.00,
    "OXY": 55.00,
    # Consumer
    "WMT": 95.00,
    "COST": 915.00,
    "MCD": 305.00,
    # ETFs
    "SPY": 545.00,
    "QQQ": 470.00,
    "IWM": 215.00,
}

# Per-ticker GBM parameters
# sigma: annualized volatility (higher = more price movement)
# mu: annualized drift / expected return
TICKER_PARAMS: dict[str, dict[str, float]] = {
    # Tech - original
    "AAPL": {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT": {"sigma": 0.20, "mu": 0.05},
    "AMZN": {"sigma": 0.28, "mu": 0.05},
    "TSLA": {"sigma": 0.50, "mu": 0.03},  # High volatility
    "NVDA": {"sigma": 0.40, "mu": 0.08},  # High volatility, strong drift
    "META": {"sigma": 0.30, "mu": 0.05},
    "NFLX": {"sigma": 0.35, "mu": 0.05},
    # Tech - new
    "AMD": {"sigma": 0.38, "mu": 0.06},
    "INTC": {"sigma": 0.30, "mu": 0.02},
    "CRM": {"sigma": 0.32, "mu": 0.05},
    "ORCL": {"sigma": 0.25, "mu": 0.05},
    "SNOW": {"sigma": 0.45, "mu": 0.05},
    "PLTR": {"sigma": 0.55, "mu": 0.07},  # High growth volatility
    # Finance - original
    "JPM": {"sigma": 0.18, "mu": 0.04},  # Low volatility (bank)
    "V": {"sigma": 0.17, "mu": 0.04},    # Low volatility (payments)
    # Finance - new
    "GS": {"sigma": 0.22, "mu": 0.04},
    "MS": {"sigma": 0.22, "mu": 0.04},
    "BAC": {"sigma": 0.20, "mu": 0.04},
    "BRK.B": {"sigma": 0.18, "mu": 0.04},
    # Healthcare
    "JNJ": {"sigma": 0.18, "mu": 0.03},
    "UNH": {"sigma": 0.22, "mu": 0.05},
    "PFE": {"sigma": 0.20, "mu": 0.02},
    "LLY": {"sigma": 0.25, "mu": 0.08},  # High growth drug pipeline
    # Energy
    "XOM": {"sigma": 0.28, "mu": 0.04},
    "CVX": {"sigma": 0.28, "mu": 0.04},
    "OXY": {"sigma": 0.35, "mu": 0.04},
    # Consumer
    "WMT": {"sigma": 0.16, "mu": 0.04},
    "COST": {"sigma": 0.18, "mu": 0.05},
    "MCD": {"sigma": 0.17, "mu": 0.04},
    # ETFs
    "SPY": {"sigma": 0.13, "mu": 0.07},
    "QQQ": {"sigma": 0.15, "mu": 0.07},
    "IWM": {"sigma": 0.14, "mu": 0.07},
}

# Default parameters for tickers not in the list above (dynamically added)
DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}

# Correlation groups for the simulator's Cholesky decomposition
# Tickers in the same group have higher intra-group correlation
CORRELATION_GROUPS: dict[str, set[str]] = {
    "tech": {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX", "AMD", "INTC", "CRM", "ORCL", "SNOW", "PLTR"},
    "finance": {"JPM", "V", "GS", "MS", "BAC", "BRK.B"},
    "healthcare": {"JNJ", "UNH", "PFE", "LLY"},
    "energy": {"XOM", "CVX", "OXY"},
    "consumer": {"WMT", "COST", "MCD"},
    "etf": {"SPY", "QQQ", "IWM"},
}

# Intra-group correlation coefficients
INTRA_TECH_CORR = 0.60       # Tech stocks move together
INTRA_FINANCE_CORR = 0.50    # Finance stocks move together
INTRA_HEALTHCARE_CORR = 0.45
INTRA_ENERGY_CORR = 0.55
INTRA_CONSUMER_CORR = 0.40
INTRA_ETF_CORR = 0.80        # ETFs are highly correlated

# Cross-group / fallback
CROSS_GROUP_CORR = 0.30      # Between sectors / unknown tickers
TSLA_CORR = 0.30             # TSLA does its own thing

# Map group name -> intra-group correlation constant (used by simulator)
GROUP_CORR: dict[str, float] = {
    "tech": INTRA_TECH_CORR,
    "finance": INTRA_FINANCE_CORR,
    "healthcare": INTRA_HEALTHCARE_CORR,
    "energy": INTRA_ENERGY_CORR,
    "consumer": INTRA_CONSUMER_CORR,
    "etf": INTRA_ETF_CORR,
}
