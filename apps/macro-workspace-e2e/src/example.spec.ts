import { test, expect, chromium, Browser, BrowserContext, Page, CDPSession } from '@playwright/test';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let providerPage: Page | null = null;
let cdpSession: CDPSession | null = null;
let usingOpenFin = false;

test.describe('Macro Workspace OpenFin Application', () => {
  test.beforeAll(async () => {
    // Connect to OpenFin via Chrome DevTools Protocol
    // OpenFin exposes CDP on port 9090 (as configured in manifest.fin.json)
    const openfinDevtoolsPort = process.env['OPENFIN_DEVTOOLS_PORT'] || '9090';
    const cdpUrl = `http://localhost:${openfinDevtoolsPort}`;

    // Wait for OpenFin to potentially be ready
    // Note: OpenFin should be launched separately before running tests
    // Use: npm run launch (or node apps/macro-workspace/launch.mjs http://localhost:4202/manifest.fin.json)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // Try to connect to OpenFin via CDP
      browser = await chromium.connectOverCDP(cdpUrl);
      usingOpenFin = true;

      const contexts = browser.contexts();

      if (contexts.length > 0) {
        context = contexts[0];
        const pages = context.pages();
        const pagesCount = pages.length;
        console.log(`Connected to OpenFin. Context has ${pagesCount} pages.`);

        for (const page of pages) {
          const url = page.url();
          console.log('MM Page URL:', url);
          const title = await page.title();
          if(title == 'macro-workspace') {
            console.log('Found provider page');
            providerPage = page;
          }
          console.log('MM Page Title:', title);
        }

        // find page with title = 'macro-worksapce'



        if (providerPage) {
          // Use existing page from OpenFin

          // Create CDP session for OpenFin API access
          cdpSession = await context.newCDPSession(providerPage);
        }
      }

      console.log('Successfully connected to OpenFin via CDP');
    } catch (error) {
      console.warn('Failed to connect to OpenFin via CDP, falling back to regular browser:', error);
      console.warn('To test with OpenFin, launch it first: npm run launch');

    }
  });

  test.afterAll(async () => {
    // IMPORTANT: Do not close the provider window or OpenFin will exit
    // The provider window is the platform window that keeps OpenFin running
    // Only disconnect from CDP, don't close any windows or contexts

    if (browser && usingOpenFin) {
      // Just disconnect from CDP, don't close the browser, context, or pages
      // Closing the provider window would cause OpenFin workspace to exit
      // This allows OpenFin to continue running after tests complete
      await browser.close();
    }
    // Clean up CDP session if it exists
    if (cdpSession) {
      cdpSession = null;
    }
  });

  test('should display provider page with title', async () => {


    if (!providerPage) {
      test.skip();
      return;
    }

    await providerPage.bringToFront();


    await providerPage.evaluate(async () => {

      const finGlobal = (window as any).fin;
      if (!finGlobal || !finGlobal.Window) {
        console.warn('fin not available in this renderer');
        return;
      }
      try {
        // getCurrentSync is an OpenFin renderer API — call if present
        console.log('Calling OpenFin Window API to show and focus window');
        const w = finGlobal.Window.getCurrentSync();
        await w.show(true);
        await w.restore();
        await w.maximize();
        await w.bringToFront();
        await w.focus();

        await w.bringToFront();
        console.log('OpenFin window shown and focused : ', w.identity);
      } catch (err) {
        console.warn('OpenFin window API call failed:', err);
      }
      return;
    });

    // locate h1 with class tag
    await new Promise((resolve) => setTimeout(resolve, 3000));


    const statusHeader = providerPage.locator('p.message').first();
    const text = await statusHeader.innerText();

    console.log('Locator:  Inner Text : ', text);
    // await page.goto('http://localhost:4202/provider');
    await expect(statusHeader).toBeVisible();
    await expect(statusHeader).toContainText('Status: Platform initialized');


//    await expect(page.locator('h1')).toContainText('OpenFin Platform Window');
  });
  
  /*


  test('should have OpenFin Dock visible', async () => {
    if (!page || !usingOpenFin) {
      test.skip();
      return;
    }

    // Wait for Dock to be initialized
    await page.waitForTimeout(5000);

    // Look for Dock container - OpenFin Dock typically has specific class names or IDs
    // The Dock is usually rendered as a bottom bar or side panel
    // OpenFin Dock uses shadow DOM, so we need to look for it differently
    const dockSelectors = [
      'fin-dock',
      '[class*="dock"]',
      '[id*="dock"]',
      '[data-testid*="dock"]',
      'div[class*="Dock"]',
      'div[class*="dock-container"]'
    ];

    let dockFound = false;
    for (const selector of dockSelectors) {
      const dock = page.locator(selector).first();
      if (await dock.count() > 0) {
        await expect(dock).toBeVisible();
        dockFound = true;
        break;
      }
    }

    // If Dock uses shadow DOM, we might need to access it differently
    if (!dockFound) {
      // Try to find Dock buttons which are more likely to be visible
      const dockButtons = page.locator('button, [role="button"]').filter({ hasText: /Store|Home|Apps|Notifications/i });
      const buttonCount = await dockButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
    }
  });

  test('should click on Storefront button in Dock', async () => {
    if (!page || !usingOpenFin || !cdpSession) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Look for Storefront button in Dock
    // OpenFin Dock buttons typically have tooltips, aria-labels, or specific text
    const storefrontSelectors = [
      'button[aria-label*="Store"]',
      'button[aria-label*="storefront"]',
      'button[title*="Store"]',
      'button[title*="storefront"]',
      '[class*="store-button"]',
      'button:has-text("Store")',
      'button:has-text("Storefront")',
      '[data-action="storefront"]'
    ];

    let storefrontButton = null;
    for (const selector of storefrontSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        storefrontButton = button;
        break;
      }
    }

    if (storefrontButton) {
      await storefrontButton.click();
      await page.waitForTimeout(3000);

      // Verify Storefront opened - look for storefront content
      // Storefront might open in a new window or overlay
      const allPages = context?.pages() || [];
      let storefrontFound = false;

      for (const p of allPages) {
        const url = p.url();
        const title = await p.title();
        if (url.includes('storefront') || title.toLowerCase().includes('storefront') || title.toLowerCase().includes('store')) {
          storefrontFound = true;
          break;
        }
      }

      // Also check for storefront UI elements
      const storefront = page.locator('[class*="storefront"], [id*="storefront"], [data-testid*="storefront"], fin-storefront').first();
      if (await storefront.count() > 0) {
        storefrontFound = true;
      }

      expect(storefrontFound).toBeTruthy();
    } else {
      // Try using OpenFin API via CDP to show storefront
      try {
        await cdpSession.send('Runtime.evaluate', {
          expression: `
            (async () => {
              if (typeof fin !== 'undefined' && fin.Storefront) {
                await fin.Storefront.show();
                return true;
              }
              return false;
            })()
          `
        });
        await page.waitForTimeout(3000);
      } catch (error) {
        console.warn('Could not open Storefront via API:', error);
      }
    }
  });

  test('should open Apps dropdown in Dock', async () => {
    if (!page || !usingOpenFin) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Look for Apps dropdown button in Dock
    // Based on dock.service.ts, the dropdown has id 'apps' and tooltip 'Apps'
    const appsDropdownSelectors = [
      'button[id="apps"]',
      'button[aria-label*="Apps"]',
      'button[title*="Apps"]',
      'button[title*="apps"]',
      '[class*="apps-dropdown"]',
      'button:has-text("Apps")',
      '[data-button-id="apps"]'
    ];

    let appsDropdown = null;
    for (const selector of appsDropdownSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        appsDropdown = button;
        break;
      }
    }

    if (appsDropdown) {
      await appsDropdown.click();
      await page.waitForTimeout(2000);

      // Verify dropdown menu is visible
      const dropdownMenuSelectors = [
        '[role="menu"]',
        '[role="listbox"]',
        '[class*="dropdown-menu"]',
        '[class*="apps-menu"]',
        '[class*="menu"]',
        '[class*="dropdown"]',
        'ul[class*="menu"]',
        'div[class*="menu"]'
      ];

      let menuFound = false;
      for (const selector of dropdownMenuSelectors) {
        const menu = page.locator(selector).first();
        if (await menu.count() > 0 && await menu.isVisible()) {
          await expect(menu).toBeVisible();
          menuFound = true;
          break;
        }
      }

      // If menu not found by selector, check if any app options are visible
      if (!menuFound) {
        const appOption = page.locator('text=Macro Workspace View 1, text=FX Market Data').first();
        if (await appOption.count() > 0) {
          menuFound = true;
        }
      }

      expect(menuFound).toBeTruthy();
    }
  });

  test('should launch view from Dock dropdown', async () => {
    if (!page || !usingOpenFin || !context) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Open Apps dropdown
    const appsDropdownSelectors = [
      'button[id="apps"]',
      'button[aria-label*="Apps"]',
      'button[title*="Apps"]',
      'button:has-text("Apps")'
    ];

    let appsDropdown = null;
    for (const selector of appsDropdownSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        appsDropdown = button;
        break;
      }
    }

    if (appsDropdown) {
      await appsDropdown.click();
      await page.waitForTimeout(2000);

      // Look for a view option in the dropdown (e.g., "Macro Workspace View 1")
      const view1Selectors = [
        'text=Macro Workspace View 1',
        'text=macro-workspace-view1',
        '[data-app-id="macro-workspace-view1"]',
        '[data-action="launch-app"]:has-text("View 1")',
        'li:has-text("Macro Workspace View 1")',
        'div:has-text("Macro Workspace View 1")',
        'button:has-text("Macro Workspace View 1")'
      ];

      let view1Option = null;
      for (const selector of view1Selectors) {
        const option = page.locator(selector).first();
        if (await option.count() > 0) {
          view1Option = option;
          break;
        }
      }

      if (view1Option) {
        await view1Option.click();
        await page.waitForTimeout(4000);

        // Verify view was launched - check for view1 content or new window
        // The view might open in a new window, so we check all pages
        const allPages = context.pages();
        let view1Found = false;

        for (const p of allPages) {
          const url = p.url();
          if (url.includes('view1')) {
            view1Found = true;
            await expect(p.locator('h1')).toContainText('OpenFin Angular View 1');
            break;
          }
        }

        // Also check if current page navigated to view1
        if (!view1Found && page.url().includes('view1')) {
          view1Found = true;
          await expect(page.locator('h1')).toContainText('OpenFin Angular View 1');
        }

        expect(view1Found).toBeTruthy();
      }
    }
  });

  test('should launch multiple views from Dock dropdown', async () => {
    if (!page || !usingOpenFin) {
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);

    // Open Apps dropdown
    const appsDropdown = page.locator(
      'button[id="apps"], button[aria-label*="Apps"], button[title*="Apps"]'
    ).first();

    if (await appsDropdown.count() > 0) {
      await appsDropdown.click();
      await page.waitForTimeout(1000);

      // Launch View 2
      const view2Option = page.locator(
        'text=Macro Workspace View 2, text=macro-workspace-view2, [data-app-id="macro-workspace-view2"]'
      ).first();

      if (await view2Option.count() > 0) {
        await view2Option.click();
        await page.waitForTimeout(3000);

        // Verify view2 was launched
        const allPages = context?.pages() || [];
        let view2Found = false;

        for (const p of allPages) {
          const url = p.url();
          if (url.includes('view2')) {
            view2Found = true;
            await expect(p.locator('h1')).toContainText('OpenFin Angular View 2');
            break;
          }
        }

        expect(view2Found).toBeTruthy();
      }
    }
  });

  test('should launch Angular app views from Dock dropdown', async () => {
    if (!page || !usingOpenFin) {
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);

    // Open Apps dropdown
    const appsDropdown = page.locator(
      'button[id="apps"], button[aria-label*="Apps"], button[title*="Apps"]'
    ).first();

    if (await appsDropdown.count() > 0) {
      await appsDropdown.click();
      await page.waitForTimeout(1000);

      // Look for FX Market Data option
      const fxMarketDataOption = page.locator(
        'text=FX Market Data, text=macro-angular-fx-market-data, [data-app-id="macro-angular-fx-market-data"]'
      ).first();

      if (await fxMarketDataOption.count() > 0) {
        await fxMarketDataOption.click();
        await page.waitForTimeout(3000);

        // Verify Angular app view was launched
        const allPages = context?.pages() || [];
        let fxViewFound = false;

        for (const p of allPages) {
          const url = p.url();
          if (url.includes('4200') && url.includes('fx-market-data')) {
            fxViewFound = true;
            await expect(p.locator('h1')).toContainText('FX Market Data');
            break;
          }
        }

        expect(fxViewFound).toBeTruthy();
      }
    }
  });

  test('should launch React app views from Dock dropdown', async () => {
    if (!page || !usingOpenFin) {
      test.skip();
      return;
    }

    await page.waitForTimeout(3000);

    // Open Apps dropdown
    const appsDropdown = page.locator(
      'button[id="apps"], button[aria-label*="Apps"], button[title*="Apps"]'
    ).first();

    if (await appsDropdown.count() > 0) {
      await appsDropdown.click();
      await page.waitForTimeout(1000);

      // Look for Treasury Market Data option
      const treasuryMarketDataOption = page.locator(
        'text=Treasury Market Data, text=macro-react-treasury-market-data, [data-app-id="macro-react-treasury-market-data"]'
      ).first();

      if (await treasuryMarketDataOption.count() > 0) {
        await treasuryMarketDataOption.click();
        await page.waitForTimeout(3000);

        // Verify React app view was launched
        const allPages = context?.pages() || [];
        let reactViewFound = false;

        for (const p of allPages) {
          const url = p.url();
          if (url.includes('4201') && url.includes('treasury-market-data')) {
            reactViewFound = true;
            await expect(p.locator('h1')).toContainText('On-The-Run Treasury Market Data');
            break;
          }
        }

        expect(reactViewFound).toBeTruthy();
      }
    }
  });

  test('should display Home component', async () => {
    if (!page || !usingOpenFin || !cdpSession) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Look for Home button in Dock
    const homeButtonSelectors = [
      'button[aria-label*="Home"]',
      'button[title*="Home"]',
      'button[title*="home"]',
      '[class*="home-button"]',
      'button:has-text("Home")',
      '[data-action="home"]'
    ];

    let homeButton = null;
    for (const selector of homeButtonSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        homeButton = button;
        break;
      }
    }

    if (homeButton) {
      await homeButton.click();
      await page.waitForTimeout(3000);

      // Verify Home component is visible
      const homeSelectors = [
        '[class*="home"]',
        '[id*="home"]',
        '[data-testid*="home"]',
        'fin-home',
        'div[class*="Home"]'
      ];

      let homeFound = false;
      for (const selector of homeSelectors) {
        const home = page.locator(selector).first();
        if (await home.count() > 0) {
          await expect(home).toBeVisible();
          homeFound = true;
          break;
        }
      }

      // Check if Home opened in a new window
      if (!homeFound) {
        const allPages = context?.pages() || [];
        for (const p of allPages) {
          const title = await p.title();
          if (title.toLowerCase().includes('home')) {
            homeFound = true;
            break;
          }
        }
      }
    } else if (cdpSession) {
      // Try using OpenFin API via CDP to show home
      try {
        await cdpSession.send('Runtime.evaluate', {
          expression: `
            (async () => {
              if (typeof fin !== 'undefined' && fin.Home) {
                await fin.Home.show();
                return true;
              }
              return false;
            })()
          `
        });
        await page.waitForTimeout(3000);
      } catch (error) {
        console.warn('Could not open Home via API:', error);
      }
    }
  });

  test('should interact with Storefront and launch app', async () => {
    if (!page || !usingOpenFin || !cdpSession || !context) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Open Storefront via CDP API
    try {
      await cdpSession.send('Runtime.evaluate', {
        expression: `
          (async () => {
            if (typeof fin !== 'undefined' && fin.Storefront) {
              await fin.Storefront.show();
              return true;
            }
            return false;
          })()
        `
      });
      await page.waitForTimeout(3000);
    } catch (error) {
      console.warn('Could not open Storefront via API:', error);
    }

    // Look for an app in the Storefront (e.g., Macro Workspace View 1)
    const appCardSelectors = [
      'text=Macro Workspace View 1',
      '[data-app-id="macro-workspace-view1"]',
      '[class*="app-card"]',
      '[class*="app-item"]',
      'div:has-text("Macro Workspace View 1")',
      'button:has-text("Macro Workspace View 1")',
      '[data-action="launch"]:has-text("View 1")'
    ];

    let appCard = null;
    for (const selector of appCardSelectors) {
      const card = page.locator(selector).first();
      if (await card.count() > 0) {
        appCard = card;
        break;
      }
    }

    if (appCard) {
      await appCard.click();
      await page.waitForTimeout(4000);

      // Verify app was launched
      const allPages = context.pages();
      let appLaunched = false;

      for (const p of allPages) {
        const url = p.url();
        if (url.includes('view1')) {
          appLaunched = true;
          break;
        }
      }

      expect(appLaunched).toBeTruthy();
    }
  });

  test('should navigate to view1 directly', async () => {
    if (!page) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:4202/view1');
    await expect(page.locator('h1')).toContainText('OpenFin Angular View 1');
  });

  test('should navigate to view2 directly', async () => {
    if (!page) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:4202/view2');
    await expect(page.locator('h1')).toContainText('OpenFin Angular View 2');
  });

  test('should interact with view1 buttons', async () => {
    if (!page) {
      test.skip();
      return;
    }

    await page.goto('http://localhost:4202/view1');

    // Check for notification button
    const notificationButton = page.locator('button:has-text("Show Notification")');
    await expect(notificationButton).toBeVisible();
    await notificationButton.click();
    await page.waitForTimeout(1000);

    // Check for FDC3 context broadcast button
    const fdc3Button = page.locator('button:has-text("Broadcast FDC3 Context")');
    await expect(fdc3Button).toBeVisible();
    await fdc3Button.click();
    await page.waitForTimeout(1000);

    // Check for app channel broadcast button
    const appChannelButton = page.locator('button:has-text("Broadcast Context on App Channel")');
    await expect(appChannelButton).toBeVisible();
    await appChannelButton.click();
    await page.waitForTimeout(1000);
  });

  test('should verify Dock has all registered apps', async () => {
    if (!page || !usingOpenFin || !cdpSession) {
      test.skip();
      return;
    }

    await page.waitForTimeout(5000);

    // Get Dock info via OpenFin API through CDP
    try {
      const dockInfoResult = await cdpSession.send('Runtime.evaluate', {
        expression: `
          (async () => {
            if (typeof fin !== 'undefined' && fin.Dock) {
              try {
                const info = await fin.Dock.getInfo();
                return JSON.stringify(info);
              } catch (e) {
                return null;
              }
            }
            return null;
          })()
        `
      });

      if (dockInfoResult.result?.value) {
        const dockInfo = JSON.parse(dockInfoResult.result.value);
        expect(dockInfo).toBeDefined();
      }

      // Verify apps dropdown exists
      const appsDropdownSelectors = [
        'button[id="apps"]',
        'button[aria-label*="Apps"]',
        'button[title*="Apps"]',
        'button:has-text("Apps")'
      ];

      let appsDropdown = null;
      for (const selector of appsDropdownSelectors) {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          appsDropdown = button;
          break;
        }
      }

      if (appsDropdown) {
        await appsDropdown.click();
        await page.waitForTimeout(2000);

        // Check for various app options in dropdown
        const expectedApps = [
          'Macro Workspace View 1',
          'Macro Workspace View 2',
          'Macro Angular App',
          'FX Market Data',
          'Treasury Microstructure',
          'Macro React App',
          'Treasury Market Data',
          'Commodities Dashboard'
        ];

        let appsFound = 0;
        for (const appName of expectedApps) {
          const appOption = page.locator(`text=${appName}`).first();
          if (await appOption.count() > 0) {
            appsFound++;
            await expect(appOption).toBeVisible();
          }
        }

        // At least some apps should be visible
        expect(appsFound).toBeGreaterThan(0);
      }
    } catch (error) {
      console.warn('Could not verify Dock apps:', error);
    }
  });


  */
});
