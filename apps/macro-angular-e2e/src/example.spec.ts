import { test, expect } from '@playwright/test';

test.describe('Macro Angular Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to FX Market Data on root path', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*fx-market-data/);
  });

  test('should display FX Market Data page with title', async ({ page }) => {
    await page.goto('/fx-market-data');
    await expect(page.locator('h1')).toContainText('FX Market Data');
  });

  test('should display navigation menu bar', async ({ page }) => {
    const menubar = page.locator('p-menubar');
    await expect(menubar).toBeVisible();
  });

  test('should have FX Market Data menu item', async ({ page }) => {
    const fxMenuItem = page.locator('text=FX Market Data');
    await expect(fxMenuItem).toBeVisible();
  });

  test('should have Treasury Microstructure menu item', async ({ page }) => {
    const treasuryMenuItem = page.locator('text=Treasury Microstructure');
    await expect(treasuryMenuItem).toBeVisible();
  });

  test('should navigate to Treasury Microstructure via menu', async ({ page }) => {
    await page.goto('/fx-market-data');
    await page.locator('text=Treasury Microstructure').click();
    await expect(page).toHaveURL(/.*treasury-microstructure/);
    await expect(page.locator('h1')).toContainText('US Treasury E-Trading Market Microstructure');
  });

  test('should navigate to FX Market Data via menu', async ({ page }) => {
    await page.goto('/treasury-microstructure');
    await page.locator('text=FX Market Data').click();
    await expect(page).toHaveURL(/.*fx-market-data/);
    await expect(page.locator('h1')).toContainText('FX Market Data');
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

  test('should display FX Market Data grid', async ({ page }) => {
    await page.goto('/fx-market-data');
    const grid = page.locator('lib-macro-angular-grid');
    await expect(grid).toBeVisible();
  });

  test('should display currency pairs in FX Market Data grid', async ({ page }) => {
    await page.goto('/fx-market-data');
    
    // Wait for grid to load data
    await page.waitForTimeout(2000);
    
    // Check if grid has data (ag-grid cells)
    const gridCells = page.locator('.ag-cell');
    const cellCount = await gridCells.count();
    expect(cellCount).toBeGreaterThan(0);
  });

  test('should display Treasury Microstructure page with charts', async ({ page }) => {
    await page.goto('/treasury-microstructure');
    await expect(page.locator('h1')).toContainText('US Treasury E-Trading Market Microstructure');
    
    // Check for chart containers
    const chartsContainer = page.locator('.microstructure-container');
    await expect(chartsContainer).toBeVisible();
    
    // Check for charts grid
    const chartsGrid = page.locator('.charts-grid');
    await expect(chartsGrid).toBeVisible();
  });

  test('should have four chart containers in Treasury Microstructure', async ({ page }) => {
    await page.goto('/treasury-microstructure');
    
    // Wait for charts to initialize
    await page.waitForTimeout(2000);
    
    const chartContainers = page.locator('.chart-container');
    const count = await chartContainers.count();
    expect(count).toBe(4);
  });

  test('should navigate directly to routes', async ({ page }) => {
    // Test direct navigation to FX Market Data
    await page.goto('/fx-market-data');
    await expect(page).toHaveURL(/.*fx-market-data/);
    
    // Test direct navigation to Treasury Microstructure
    await page.goto('/treasury-microstructure');
    await expect(page).toHaveURL(/.*treasury-microstructure/);
  });

  test('should maintain navigation state after page reload', async ({ page }) => {
    await page.goto('/treasury-microstructure');
    await expect(page).toHaveURL(/.*treasury-microstructure/);
    
    await page.reload();
    await expect(page).toHaveURL(/.*treasury-microstructure/);
    await expect(page.locator('h1')).toContainText('US Treasury E-Trading Market Microstructure');
  });
});
