import { test, expect } from '@playwright/test';

test.describe('Macro React Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to Treasury Market Data on root path', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*treasury-market-data/);
  });

  test('should display Treasury Market Data page with title', async ({ page }) => {
    await page.goto('/treasury-market-data');
    await expect(page.locator('h1')).toContainText('On-The-Run Treasury Market Data');
  });

  test('should display navigation menu bar', async ({ page }) => {
    const menubar = page.locator('[role="menubar"]');
    await expect(menubar).toBeVisible();
  });

  test('should have Treasury Market Data menu item', async ({ page }) => {
    const treasuryMenuItem = page.locator('text=Treasury Market Data');
    await expect(treasuryMenuItem).toBeVisible();
  });

  test('should have Commodities Dashboard menu item', async ({ page }) => {
    const commoditiesMenuItem = page.locator('text=Commodities Dashboard');
    await expect(commoditiesMenuItem).toBeVisible();
  });

  test('should navigate to Commodities Dashboard via menu', async ({ page }) => {
    await page.goto('/treasury-market-data');
    await page.locator('text=Commodities Dashboard').click();
    await expect(page).toHaveURL(/.*commodities-dashboard/);
    await expect(page.locator('h1')).toContainText('Commodities Trading Dashboard');
  });

  test('should navigate to Treasury Market Data via menu', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    await page.locator('text=Treasury Market Data').click();
    await expect(page).toHaveURL(/.*treasury-market-data/);
    await expect(page.locator('h1')).toContainText('On-The-Run Treasury Market Data');
  });

  test('should display theme toggle button', async ({ page }) => {
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
  });

  test('should toggle theme when theme button is clicked', async ({ page }) => {
    const themeButton = page.locator('button[aria-label="Toggle theme"]');
    const initialText = await themeButton.locator('span').textContent();
    
    await themeButton.click();
    
    // Wait for theme change
    await page.waitForTimeout(500);
    
    const newText = await themeButton.locator('span').textContent();
    expect(newText).not.toBe(initialText);
  });

  test('should display Treasury Market Data grid', async ({ page }) => {
    await page.goto('/treasury-market-data');
    
    // Wait for grid to load
    await page.waitForTimeout(2000);
    
    // Check if grid component is present
    const grid = page.locator('lib-macro-react-grid');
    await expect(grid).toBeVisible();
  });

  test('should display treasury securities in grid', async ({ page }) => {
    await page.goto('/treasury-market-data');
    
    // Wait for grid to load data
    await page.waitForTimeout(2000);
    
    // Check if grid has data (ag-grid cells)
    const gridCells = page.locator('.ag-cell');
    const cellCount = await gridCells.count();
    expect(cellCount).toBeGreaterThan(0);
  });

  test('should display Commodities Dashboard page with title', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    await expect(page.locator('h1')).toContainText('Commodities Trading Dashboard');
  });

  test('should display commodity category selector', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    
    // Wait for component to initialize
    await page.waitForTimeout(1000);
    
    // Check for category selector (should have Energy, Metals, Agriculture options)
    const categorySelector = page.locator('text=Energy, text=Metals, text=Agriculture').first();
    await expect(categorySelector).toBeVisible();
  });

  test('should display commodity selection controls', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    
    // Wait for component to initialize
    await page.waitForTimeout(1000);
    
    // Check for commodity selection (should have various commodities)
    const commoditySelector = page.locator('text=Crude Oil, text=Natural Gas, text=Gold').first();
    await expect(commoditySelector).toBeVisible();
  });

  test('should display charts in Commodities Dashboard', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    
    // Wait for charts to initialize
    await page.waitForTimeout(2000);
    
    // Check for chart containers (Recharts components)
    const charts = page.locator('svg.recharts-surface');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThan(0);
  });

  test('should navigate directly to routes', async ({ page }) => {
    // Test direct navigation to Treasury Market Data
    await page.goto('/treasury-market-data');
    await expect(page).toHaveURL(/.*treasury-market-data/);
    
    // Test direct navigation to Commodities Dashboard
    await page.goto('/commodities-dashboard');
    await expect(page).toHaveURL(/.*commodities-dashboard/);
  });

  test('should maintain navigation state after page reload', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    await expect(page).toHaveURL(/.*commodities-dashboard/);
    
    await page.reload();
    await expect(page).toHaveURL(/.*commodities-dashboard/);
    await expect(page.locator('h1')).toContainText('Commodities Trading Dashboard');
  });

  test('should display play/pause controls in Commodities Dashboard', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    
    // Wait for component to initialize
    await page.waitForTimeout(1000);
    
    // Check for play/pause button or controls
    const playPauseControls = page.locator('text=Play, text=Pause, button').first();
    await expect(playPauseControls).toBeVisible();
  });

  test('should display market statistics in Commodities Dashboard', async ({ page }) => {
    await page.goto('/commodities-dashboard');
    
    // Wait for component to initialize
    await page.waitForTimeout(2000);
    
    // Check for market stats (volume, spread, volatility, etc.)
    const marketStats = page.locator('text=Volume, text=Spread, text=Volatility').first();
    await expect(marketStats).toBeVisible();
  });
});
