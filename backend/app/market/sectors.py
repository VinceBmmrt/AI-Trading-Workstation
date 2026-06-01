"""Sector metadata for all tracked tickers."""

SECTOR_MAP: dict[str, str] = {
    # Tech
    "AAPL": "Tech",
    "GOOGL": "Tech",
    "MSFT": "Tech",
    "AMZN": "Tech",
    "TSLA": "Tech",
    "NVDA": "Tech",
    "META": "Tech",
    "NFLX": "Tech",
    "AMD": "Tech",
    "INTC": "Tech",
    "CRM": "Tech",
    "ORCL": "Tech",
    "SNOW": "Tech",
    "PLTR": "Tech",
    # Finance
    "JPM": "Finance",
    "V": "Finance",
    "GS": "Finance",
    "MS": "Finance",
    "BAC": "Finance",
    "BRK.B": "Finance",
    # Healthcare
    "JNJ": "Healthcare",
    "UNH": "Healthcare",
    "PFE": "Healthcare",
    "LLY": "Healthcare",
    # Energy
    "XOM": "Energy",
    "CVX": "Energy",
    "OXY": "Energy",
    # Consumer
    "WMT": "Consumer",
    "COST": "Consumer",
    "MCD": "Consumer",
    # ETFs
    "SPY": "ETF",
    "QQQ": "ETF",
    "IWM": "ETF",
}


def get_sector(ticker: str) -> str:
    """Return the sector name for a ticker, or 'Other' if unknown."""
    return SECTOR_MAP.get(ticker, "Other")
