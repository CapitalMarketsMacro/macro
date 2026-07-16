import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAddThemeSupportPrompt(server: McpServer): void {
  server.prompt(
    'add-theme-support',
    'Generate dark/light theme support code using the @macro/macro-design theme system (ThemeService / useTheme)',
    {
      framework: z.enum(['angular', 'react']).describe('Target framework'),
      componentName: z.string().describe('Root component name in PascalCase (e.g., "App", "MyLobApp")'),
    },
    async ({ framework, componentName }) => {
      let text: string;

      if (framework === 'angular') {
        text = `Add dark/light theme support to the Angular app with root component ${componentName}.
The shared \`@macro/macro-design\` theme system (default theme \`macro\`) handles
dark/light state, localStorage persistence, and OS + OpenFin theme sync for you.

## Step 1: Import the shared CSS (3-file chain) in \`styles.css\`

These must come **before** any framework-specific CSS, in this exact order:

\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
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
        options: { darkModeSelector: '.dark' }, // ties PrimeNG to the same .dark class
      },
    }),
  ],
};
\`\`\`

## Step 3: Inject \`ThemeService\` in the root component

\`ThemeService\` (from \`@macro/macro-design/angular\`, provided in root) exposes the
theme state as signals and starts the shared \`themeController\` automatically —
no constructor wiring, no manual listeners.

\`\`\`typescript
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '@macro/macro-design/angular';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [RouterOutlet],
  template: \\\`
    <button (click)="theme.toggle()" [attr.aria-label]="'Toggle theme'">
      {{ theme.isDark() ? 'Light Mode' : 'Dark Mode' }}
    </button>
    <router-outlet />
  \\\`,
})
export class ${componentName} {
  // Shared macro ThemeService — default 'macro' theme; syncs system + OpenFin.
  protected readonly theme = inject(ThemeService);
}
\`\`\`

Available signals: \`theme.isDark()\`, \`theme.mode()\`, \`theme.themeId()\`,
\`theme.theme()\`, \`theme.palette()\`. Actions: \`theme.toggle()\`,
\`theme.setDark(boolean)\`, \`theme.setTheme(id)\`.

## Step 4: AG Grid theme (if using grids)

The \`@macro/macro-angular-grid\` wrapper (\`MacroAngularGrid\`) handles AG Grid
theming automatically: it calls \`buildAgGridTheme(isDark)\` and watches \`<html>\`
for \`.dark\` changes via MutationObserver. No extra setup needed.

If wiring raw AG Grid directly, rebuild the theme from the signal:
\`\`\`typescript
import { buildAgGridTheme } from '@macro/macro-design';
const theme = buildAgGridTheme(this.theme.isDark());
\`\`\`

## How It Works

1. Injecting \`ThemeService\` calls \`themeController.start()\` — applies the initial
   \`.dark\` class (localStorage → OS preference) and attaches sync listeners.
2. \`theme.toggle()\` / \`setDark()\` flip the class on \`<html>\` and persist to localStorage.
3. PrimeNG responds to \`darkModeSelector: '.dark'\`; AG Grid wrappers watch the class.
4. With no stored preference, the theme tracks OS \`prefers-color-scheme\` and the
   OpenFin platform theme automatically.`;
      } else {
        text = `Add dark/light theme support to the React app with root component ${componentName}.
The shared \`@macro/macro-design\` theme system (default theme \`macro\`) handles
dark/light state, localStorage persistence, and OS + OpenFin theme sync for you.

## Step 1: Import the shared CSS (3-file chain) in your entry CSS file

These must come **before** any framework-specific CSS (PrimeIcons, Tailwind), in
this exact order:

\`\`\`css
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';

@import 'primeicons/primeicons.css';
@import 'tailwindcss';

@custom-variant dark (&:is(.dark *));
\`\`\`

## Step 2: Start the theme controller + configure PrimeReact in \`main.tsx\`

Call \`themeController.start()\` **before** \`createRoot\` so the \`.dark\` class is
applied before first paint (no flash):

\`\`\`tsx
import * as ReactDOM from 'react-dom/client';
import { PrimeReactProvider } from '@primereact/core/config';
import Aura from '@primeuix/themes/aura';
import { themeController } from '@macro/macro-design/react';
import App from './app/app';
import './styles.css';

themeController.start();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
    <App />
  </PrimeReactProvider>
);
\`\`\`

## Step 3: Use \`useTheme()\` in the root component

\`\`\`tsx
import { useTheme } from '@macro/macro-design/react';

export default function ${componentName}() {
  const { isDark, toggle } = useTheme();

  return (
    <div>
      <button onClick={toggle} aria-label="Toggle theme">
        {isDark ? 'Light Mode' : 'Dark Mode'}
      </button>
      {/* Your app content */}
    </div>
  );
}
\`\`\`

\`useTheme()\` returns \`{ isDark, mode, themeId, theme, palette, toggle, setDark,
setTheme }\` and subscribes via \`useSyncExternalStore\`, so all components share one
source of truth.

## Step 4: AG Grid theme (if using grids)

The \`@macro/macro-react-grid\` wrapper (\`MacroReactGrid\`) handles AG Grid theming
automatically — it calls \`buildAgGridTheme(isDark)\` and watches \`<html>\` for
\`.dark\` changes via MutationObserver. No extra setup needed.

If wiring raw AG Grid directly:
\`\`\`tsx
import { buildAgGridTheme } from '@macro/macro-design';
const theme = buildAgGridTheme(isDark);
\`\`\`

## How It Works

1. \`themeController.start()\` applies the initial \`.dark\` class (localStorage → OS
   preference) and attaches OS + OpenFin sync listeners (idempotent).
2. \`useTheme().toggle()\` / \`setDark()\` flip the class on \`<html>\` and persist to localStorage.
3. PrimeReact responds to \`darkModeSelector: '.dark'\`; Tailwind to
   \`@custom-variant dark (&:is(.dark *))\`; AG Grid wrappers watch the class.
4. With no stored preference, the theme tracks OS \`prefers-color-scheme\` and the
   OpenFin platform theme automatically.`;
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
