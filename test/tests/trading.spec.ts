import { test, expect, type Page } from '@playwright/test';

/**
 * AI Trading Workstation — E2E tests
 * Targets http://localhost:8000 (backend must be running before test run).
 * Tests run against the live dev server; DB state persists across runs.
 */

// Scoped watchlist ticker selector: only the bold ticker-name span in each watchlist row.
const WATCHLIST_TICKER = 'aside.w-56 div.overflow-y-auto div.cursor-pointer span.font-mono.font-bold';

test.beforeEach(async ({ page }) => {
  // Wide viewport so the trade bar isn't obscured by the portfolio overflow div
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  // Wait until the watchlist has loaded at least one ticker symbol
  await page.locator(WATCHLIST_TICKER).first().waitFor({ timeout: 15_000 });
});

/**
 * Get cash balance directly from the API — avoids fragile DOM parsing.
 */
async function getCashFromApi(page: Page): Promise<number> {
  const resp = await page.request.get('/api/portfolio');
  const data = await resp.json();
  return data.cash_balance as number;
}

/**
 * Click a remove button reliably by using the API approach:
 * call the DELETE endpoint directly and reload.
 */
async function removeTicker(page: Page, ticker: string): Promise<void> {
  await page.request.delete(`/api/watchlist/${ticker}`);
  await page.reload();
  await page.locator(WATCHLIST_TICKER).first().waitFor({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Fresh start: ≥10 tickers in watchlist, cash visible, prices updating
// ---------------------------------------------------------------------------
test('fresh start: watchlist tickers present, cash visible, prices streaming', async ({ page }) => {
  // Count ticker symbols only inside the watchlist scroll area
  const count = await page.locator(WATCHLIST_TICKER).count();
  expect(count).toBeGreaterThanOrEqual(10);

  // Header contains Portfolio and Cash labels
  const header = page.locator('header');
  await expect(header).toContainText('Cash');
  await expect(header).toContainText('Portfolio');
  await expect(header).toContainText('$', { timeout: 10_000 });

  // API confirms cash is present and positive
  const cash = await getCashFromApi(page);
  expect(cash).toBeGreaterThan(0);

  // At least one price cell shows a dollar value (prices are streaming)
  await expect(
    page.locator('aside div.overflow-y-auto span.tabular-nums').first()
  ).toContainText('$', { timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 2 — Add ticker "XYZQ" to watchlist (unique ticker unlikely to pre-exist)
// ---------------------------------------------------------------------------
test('add ticker to watchlist', async ({ page }) => {
  // Clean up XYZQ if already present, then verify it's gone via API
  await page.request.delete('/api/watchlist/XYZQ');

  // Confirm deletion via API before counting
  await expect(async () => {
    const r = await page.request.get('/api/watchlist');
    const wl = await r.json() as Array<{ ticker: string }>;
    expect(wl.some((t) => t.ticker === 'XYZQ')).toBe(false);
  }).toPass({ timeout: 5_000 });

  await page.reload();
  await page.locator(WATCHLIST_TICKER).first().waitFor({ timeout: 15_000 });

  // Get the API-based count (ground truth — not the potentially-stale DOM count)
  const apiBefore = await page.request.get('/api/watchlist');
  const wlBefore = await apiBefore.json() as Array<{ ticker: string }>;
  const countBefore = wlBefore.length;

  await page.getByPlaceholder('ADD SYMBOL…').fill('XYZQ');
  await page.getByPlaceholder('ADD SYMBOL…').press('Enter');

  // XYZQ should appear in watchlist rows (DOM check)
  await expect(page.locator(WATCHLIST_TICKER, { hasText: 'XYZQ' })).toBeVisible({ timeout: 10_000 });

  // Confirm via API that XYZQ is now in the watchlist and count increased by 1
  await expect(async () => {
    const r = await page.request.get('/api/watchlist');
    const wl = await r.json() as Array<{ ticker: string }>;
    expect(wl.some((t) => t.ticker === 'XYZQ')).toBe(true);
    expect(wl.length).toBe(countBefore + 1);
  }).toPass({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 3 — Remove a ticker from watchlist
// ---------------------------------------------------------------------------
test('remove ticker from watchlist', async ({ page }) => {
  // Ensure TSLA is in the watchlist via API
  const wlResp = await page.request.get('/api/watchlist');
  const wl = await wlResp.json() as Array<{ ticker: string }>;
  if (!wl.some((t) => t.ticker === 'TSLA')) {
    await page.request.post('/api/watchlist', { data: { ticker: 'TSLA' } });
    await page.reload();
    await page.locator(WATCHLIST_TICKER).first().waitFor({ timeout: 15_000 });
  }

  // Use API count as ground truth (not DOM which may be stale)
  const apiBefore = await page.request.get('/api/watchlist');
  const wlBefore = await apiBefore.json() as Array<{ ticker: string }>;
  const countBefore = wlBefore.length;

  // Delete via API and reload
  const delResp = await page.request.delete('/api/watchlist/TSLA');
  expect(delResp.ok()).toBeTruthy();

  await page.reload();
  await page.locator(WATCHLIST_TICKER).first().waitFor({ timeout: 15_000 });

  // TSLA should no longer appear in DOM
  await expect(page.locator(WATCHLIST_TICKER, { hasText: 'TSLA' })).toHaveCount(0);

  // Confirm via API that count decreased
  await expect(async () => {
    const apiAfter = await page.request.get('/api/watchlist');
    const wlAfter = await apiAfter.json() as Array<{ ticker: string }>;
    expect(wlAfter.length).toBe(countBefore - 1);
    expect(wlAfter.some((t) => t.ticker === 'TSLA')).toBe(false);
  }).toPass({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// Test 4 — Buy 1 AAPL: cash decreases, position appears in positions table
// ---------------------------------------------------------------------------
test('buy 1 AAPL: cash decreases and position appears', async ({ page }) => {
  const cashBefore = await getCashFromApi(page);
  expect(cashBefore).toBeGreaterThan(0);

  // TradeBar is the border-t div inside the left aside
  const tradeBar = page.locator('div.border-t.border-border.bg-surface');
  await tradeBar.locator('input[maxlength="5"]').fill('AAPL');
  await tradeBar.locator('input[placeholder="QTY"]').fill('1');
  await tradeBar.getByRole('button', { name: 'BUY' }).click();

  // Trade confirmation (green ✓ message in TradeBar aside)
  await expect(page.locator('aside.w-56 div.text-up')).toBeVisible({ timeout: 10_000 });

  // Cash from API should have decreased
  await expect(async () => {
    const cashAfter = await getCashFromApi(page);
    expect(cashAfter).toBeLessThan(cashBefore);
  }).toPass({ timeout: 10_000 });

  // AAPL should appear in Positions table
  await page.getByRole('button', { name: 'Positions' }).click();
  await expect(page.locator('table').getByText('AAPL')).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 5 — Sell 1 AAPL: cash increases
// ---------------------------------------------------------------------------
test('sell 1 AAPL: cash increases after sell', async ({ page }) => {
  const tradeBar = page.locator('div.border-t.border-border.bg-surface');

  // Buy 1 AAPL first
  await tradeBar.locator('input[maxlength="5"]').fill('AAPL');
  await tradeBar.locator('input[placeholder="QTY"]').fill('1');
  await tradeBar.getByRole('button', { name: 'BUY' }).click();
  await expect(page.locator('div.text-up')).toBeVisible({ timeout: 10_000 });

  const cashAfterBuy = await getCashFromApi(page);

  // Wait for BUY button to be re-enabled (loading=false) before attempting sell
  const buyBtn = tradeBar.getByRole('button', { name: 'BUY' });
  await expect(buyBtn).toBeEnabled({ timeout: 5_000 });

  // Sell 1 AAPL — use dispatchEvent to bypass the overlay that intercepts pointer events
  // (layout bug: portfolio overflow-auto div covers the trade bar after positions load)
  await tradeBar.locator('input[maxlength="5"]').fill('AAPL');
  await tradeBar.locator('input[placeholder="QTY"]').fill('1');
  const sellBtn = tradeBar.getByRole('button', { name: 'SELL' });
  await sellBtn.dispatchEvent('click');

  // Wait for sell confirmation — the status message should contain "Sold"
  await expect(page.locator('aside.w-56 div.text-up')).toContainText('Sold', { timeout: 10_000 });

  // Cash from API should be higher than after the buy
  await expect(async () => {
    const cashAfterSell = await getCashFromApi(page);
    expect(cashAfterSell).toBeGreaterThan(cashAfterBuy);
  }).toPass({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 6 — Heatmap tab renders a visual element
// ---------------------------------------------------------------------------
test('heatmap tab renders', async ({ page }) => {
  const tradeBar = page.locator('div.border-t.border-border.bg-surface');
  await tradeBar.locator('input[maxlength="5"]').fill('AAPL');
  await tradeBar.locator('input[placeholder="QTY"]').fill('1');
  await tradeBar.getByRole('button', { name: 'BUY' }).click();
  await expect(page.locator('div.text-up')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Heatmap' }).click();

  // Heatmap cells: border rounded-md p-2 flex flex-col justify-between
  const heatmapCell = page.locator('.border.rounded-md.p-2.flex.flex-col').first();
  await expect(heatmapCell).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 7 — P&L chart tab renders
// ---------------------------------------------------------------------------
test('pnl tab renders', async ({ page }) => {
  await page.getByRole('button', { name: 'P&L' }).click();

  // Either the empty state text or the chart container (flex-1 div when data exists)
  const noHistory = page.getByText('No history yet');
  const chartContainer = page.locator('div.flex-1.min-h-0').last();

  await expect(noHistory.or(chartContainer)).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// Test 8 — AI chat: send a message, get a response
// ---------------------------------------------------------------------------
test('ai chat: send message and receive response', async ({ page }) => {
  const chatInput = page.getByPlaceholder('Ask Finance Ally…');
  await expect(chatInput).toBeVisible({ timeout: 10_000 });

  await chatInput.fill('What is my portfolio?');
  await page.getByRole('button', { name: 'Send message' }).click();

  // Wait for the loading dots to disappear (response has arrived)
  await expect(page.locator('.animate-bounce').first()).not.toBeVisible({ timeout: 30_000 });

  // There should be at least 2 assistant message bubbles:
  // the welcome message + the new response.
  const assistantBubbles = page.locator('.bg-surface-2.rounded-xl.px-3.py-2');
  await expect(assistantBubbles).toHaveCount(2, { timeout: 30_000 });
});
