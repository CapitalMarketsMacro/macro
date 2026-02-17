import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddThemeSupportPrompt(server: McpServer): void {
  server.prompt(
    'add-theme-support',
    'Generate dark/light theme support code using @macro/macro-design utilities',
    {
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      componentName: z.string().describe('Root component name in PascalCase (e.g., "App", "MyLobApp")'),
    },
    async ({ framework, componentName }) => {
      let text: string;

      if (framework === 'angular') {
        text = `Add dark/light theme support to the Angular app with root component ${componentName}.

## Step 1: Import shared CSS in \`styles.css\`

These must come **before** any framework-specific CSS:

\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';

body {
  font-family: 'Ubuntu', sans-serif;
  background-color: var(--background);
  color: var(--foreground);
  transition: background-color 1s, color 1s;
}
\`\`\`

## Step 2: Configure PrimeNG in \`app.config.ts\`

\`\`\`typescript
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.dark' },
      },
    }),
  ],
};
\`\`\`

## Step 3: Add theme toggle to root component

\`\`\`typescript
import { Component, OnInit, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

@Component({
  selector: 'app-root',
  standalone: true,
  template: \\\`
    <button (click)="toggleTheme()">
      {{ isDark ? 'Light Mode' : 'Dark Mode' }}
    </button>
    <router-outlet />
  \\\`,
})
export class ${componentName} implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);

  isDark = false;
  private cleanupSystemListener?: () => void;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isDark = getInitialIsDark();
      this.cleanupSystemListener = onSystemThemeChange((isDark) => {
        this.isDark = isDark;
        applyDarkMode(this.isDark);
      });
    }
  }

  ngOnInit(): void {
    applyDarkMode(this.isDark);
  }

  ngOnDestroy(): void {
    this.cleanupSystemListener?.();
  }

  toggleTheme(): void {
    this.isDark = !this.isDark;
    applyDarkMode(this.isDark);
  }
}
\`\`\`

## Step 4: AG Grid theme (if using grids)

The \`@macro/macro-angular-grid\` wrapper handles AG Grid theming automatically.
It uses \`buildAgGridTheme(isDark)\` from \`@macro/macro-design\` and watches for
\`.dark\` class changes via MutationObserver. No extra setup needed.

If using raw AG Grid directly:
\`\`\`typescript
import { buildAgGridTheme } from '@macro/macro-design';

// In your grid component, update the theme when dark mode changes
const theme = buildAgGridTheme(this.isDark);
\`\`\`

## How It Works

1. \`getInitialIsDark()\` reads from localStorage, then system preference, then defaults to false
2. \`applyDarkMode(isDark)\` toggles \`.dark\` class on \`<html>\` and persists to localStorage
3. PrimeNG responds to \`darkModeSelector: '.dark'\` automatically
4. AG Grid wrapper watches for class changes via MutationObserver
5. \`onSystemThemeChange(cb)\` listens for OS-level color-scheme changes

## CSS Variables Available

The \`macro-design.css\` provides ~30 CSS variables in both \`:root\` and \`.dark\`:
- \`--background\`, \`--foreground\` — page background/text
- \`--primary\`, \`--primary-foreground\` — brand blue
- \`--chart-1\` through \`--chart-5\` — data visualization colors
- \`--sidebar\`, \`--sidebar-primary\`, \`--sidebar-border\` — sidebar colors
- Status colors, input colors, and more`;
      } else {
        text = `Add dark/light theme support to the React app with root component ${componentName}.

## Step 1: Import shared CSS in your entry CSS file

These must come **before** any framework-specific CSS:

\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';

body {
  font-family: 'Ubuntu', sans-serif;
  background-color: var(--background);
  color: var(--foreground);
  transition: background-color 1s, color 1s;
}
\`\`\`

## Step 2: Configure PrimeReact in \`main.tsx\`

\`\`\`tsx
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';

root.render(
  <PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
    <App />
  </PrimeReactProvider>
);
\`\`\`

## Step 3: Configure Tailwind for dark mode

In your Tailwind CSS entry file:

\`\`\`css
@custom-variant dark (&:is(.dark *));
\`\`\`

This makes Tailwind's \`dark:\` variant respond to the \`.dark\` class (matching PrimeNG/PrimeReact).

## Step 4: Add theme toggle to root component

\`\`\`tsx
import { useState, useEffect } from 'react';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

export function ${componentName}() {
  const [isDark, setIsDark] = useState(getInitialIsDark);

  // Apply dark mode class whenever isDark changes
  useEffect(() => {
    applyDarkMode(isDark);
  }, [isDark]);

  // Listen for OS-level color scheme changes
  useEffect(() => {
    return onSystemThemeChange((dark) => setIsDark(dark));
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <div>
      <button onClick={toggleTheme}>
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </button>
      {/* Your app content */}
    </div>
  );
}
\`\`\`

## Step 5: AG Grid theme (if using grids)

The \`@macro/macro-react-grid\` wrapper handles AG Grid theming automatically.
It uses \`buildAgGridTheme(isDark)\` from \`@macro/macro-design\` and watches for
\`.dark\` class changes via MutationObserver. No extra setup needed.

If using raw AG Grid directly:
\`\`\`typescript
import { buildAgGridTheme } from '@macro/macro-design';

// In your grid component
const theme = buildAgGridTheme(isDark);
\`\`\`

## How It Works

1. \`getInitialIsDark()\` reads from localStorage, then system preference, then defaults to false
2. \`applyDarkMode(isDark)\` toggles \`.dark\` class on \`<html>\` and persists to localStorage
3. PrimeReact responds to \`darkModeSelector: '.dark'\` automatically
4. Tailwind responds to \`@custom-variant dark (&:is(.dark *))\`
5. AG Grid wrapper watches for class changes via MutationObserver
6. \`onSystemThemeChange(cb)\` returns a cleanup function (pass directly to useEffect)

## CSS Variables Available

The \`macro-design.css\` provides ~30 CSS variables in both \`:root\` and \`.dark\`:
- \`--background\`, \`--foreground\` — page background/text
- \`--primary\`, \`--primary-foreground\` — brand blue
- \`--chart-1\` through \`--chart-5\` — data visualization colors
- \`--sidebar\`, \`--sidebar-primary\`, \`--sidebar-border\` — sidebar colors
- Status colors, input colors, and more`;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: { type: 'text' as const, text },
          },
        ],
      };
    }
  );
}
