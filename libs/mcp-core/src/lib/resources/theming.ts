import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const THEMING_DOC = `# Macro Theming Architecture

\`@macro/macro-design\` is the **single source of truth** for all design tokens,
theme state, and AG Grid theming. Apps NEVER redefine \`:root\`/\`.dark\` CSS
variables or duplicate theme logic — they import from this library.

The default theme is **\`macro\`** — "Macro E-Trading / Macro Cerulean": a
dark-default, trading-optimized theme. Brand color is cerulean
**\`#2AA6E6\` (dark)** / **\`#1685C2\` (light)** over cool slate neutrals.

## Tier 1: CSS Variables (3-file chain)

Every app imports **three** CSS files, in this exact order, **before** any
framework CSS (PrimeIcons, Tailwind, etc.):

\`\`\`css
/* In styles.css — order matters */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-etrading.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
\`\`\`

- **fonts.css** — loads Roboto (sans / AG Grid headers), IBM Plex Mono
  (numeric / AG Grid cells), Noto Sans + Ubuntu (body text).
- **macro-etrading.css** — the core token system (raw palette + semantic
  tokens). Defines \`--brand\`, \`--bg-canvas\`, \`--fg-1\`, \`--mkt-up\`/\`--mkt-down\`,
  \`--border-1\`, status colors, spacing/radii/shadows, PrimeNG (Aura) overrides,
  AG Grid companion styles (tick-flash, directional cells), and OpenFin hooks.
  **Dark-default**: dark tokens live under \`.dark\`, light under \`:root:not(.dark)\`.
- **macro-design.css** — the Shadcn/Tailwind bridge. Maps Shadcn variables
  (\`--background\`, \`--foreground\`, \`--primary\`, \`--card\`, \`--border\`, \`--ring\`,
  \`--chart-1..5\`, \`--sidebar-*\`) onto the macro-etrading tokens, so Tailwind
  utilities (\`bg-background\`, \`text-primary\`) and PrimeReact/PrimeNG all key off
  the same values. Tokens are **hex/var()**, not OKLCH.

## Tier 2: Theme State — ThemeController + framework adapters

The framework-agnostic \`ThemeController\` (a \`subscribe\`/\`getSnapshot\` store) owns
the reactive state and DOM side-effects: it toggles the \`.dark\` class that
PrimeNG/PrimeReact/Tailwind/AG-Grid all read, persists the user's choice to
localStorage, and syncs with OS \`prefers-color-scheme\` **and** OpenFin platform
theme changes. A shared singleton \`themeController\` is exported; thin adapters
wrap it per framework.

### Angular — \`@macro/macro-design/angular\`

\`ThemeService\` (provided in root) exposes the controller state as signals.

\`\`\`typescript
import { Component, inject } from '@angular/core';
import { ThemeService } from '@macro/macro-design/angular';

@Component({ /* ... */ })
export class App {
  protected readonly theme = inject(ThemeService);
  // template:  @if (theme.isDark()) { ... }   (click)="theme.toggle()"
}
\`\`\`

Signals: \`theme.isDark()\`, \`theme.mode()\`, \`theme.themeId()\`, \`theme.theme()\`,
\`theme.palette()\`. Actions: \`toggle()\`, \`setDark(boolean)\`, \`setTheme(id)\`.
\`ThemeService\` calls \`themeController.start()\` in its constructor, so injecting it
once wires everything up.

### React — \`@macro/macro-design/react\`

Call \`themeController.start()\` once in \`main.tsx\` (before \`createRoot\`) so the
\`.dark\` class is applied before first paint, then use the \`useTheme()\` hook.

\`\`\`tsx
// main.tsx
import { themeController } from '@macro/macro-design/react';
themeController.start();

// any component
import { useTheme } from '@macro/macro-design/react';
const { isDark, toggle, setDark, setTheme, mode, palette } = useTheme();
<button onClick={toggle}>{isDark ? 'Light' : 'Dark'}</button>
\`\`\`

\`useTheme()\` subscribes via \`useSyncExternalStore\`, so every component/view shares
one source of truth and stays in sync with OS + OpenFin theme changes.

> The legacy helpers \`getInitialIsDark()\` / \`applyDarkMode()\` /
> \`onSystemThemeChange()\` are still exported from \`@macro/macro-design\` (the
> controller is built on them) but apps should use \`ThemeService\` / \`useTheme()\`
> instead of wiring them by hand.

## Tier 3: AG Grid Theme

AG Grid uses its own Theming API. \`buildAgGridTheme(isDark)\` returns a configured
\`themeQuartz\` theme:

\`\`\`typescript
import { buildAgGridTheme, AG_GRID_FONTS } from '@macro/macro-design';

// themeQuartz + iconSetMaterial + (colorSchemeDarkBlue | colorSchemeLight)
// + Macro fonts; dark mode also layers Macro E-Trading dark tokens.
const theme = buildAgGridTheme(isDark);
\`\`\`

\`AG_GRID_FONTS\`: IBM Plex Mono cells (\`fontSize: 12\`), Roboto headers
(\`headerFontSize: 10\`), \`rowHeight: 22\`, \`headerHeight: 28\`, square corners.

Both \`MacroAngularGrid\` and \`MacroReactGrid\` apply this automatically — they watch
\`<html>\` for \`.dark\` class changes via MutationObserver and rebuild the theme. No
extra setup needed when using the wrappers.

## OpenFin Workspace Palette (\`themeConfig\` / named themes)

\`themeConfig\` (and the named-theme registry \`MACRO_THEME\` / \`getPalette\`) provide
dark/light \`ThemePalette\`s for OpenFin workspace customization:

\`\`\`typescript
import { themeConfig, getPalette, MACRO_THEME } from '@macro/macro-design';

themeConfig.dark.brandPrimary;       // '#2AA6E6'
themeConfig.light.brandPrimary;      // '#1685C2'
getPalette('dark').backgroundPrimary // '#0B0D12'
\`\`\`

The OpenFin platform (\`macro-workspace\`) feeds these palettes into its theme
provider; \`themeController\` listens for the resulting platform theme changes so
embedded views follow the workspace theme.

## Framework Integration Summary

| Concern | Angular | React |
| --- | --- | --- |
| Theme state | \`inject(ThemeService)\` (\`/angular\`) | \`useTheme()\` (\`/react\`) |
| Start | automatic (service ctor) | \`themeController.start()\` in main.tsx |
| PrimeNG/PrimeReact | \`providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } })\` | \`<PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>\` |
| Tailwind | n/a | \`@custom-variant dark (&:is(.dark *));\` + \`@theme inline\` |
| AG Grid | \`MacroAngularGrid\` (auto) | \`MacroReactGrid\` (auto) |

All four — PrimeNG, PrimeReact, Tailwind, AG Grid — key off the **same \`.dark\`
class** toggled by \`themeController\`.
`;

export function registerTheming(server: McpServer): void {
  server.resource('theming', 'macro://theming', { mimeType: 'text/markdown' }, async () => ({
    contents: [
      {
        uri: 'macro://theming',
        text: THEMING_DOC,
        mimeType: 'text/markdown',
      },
    ],
  }));
}
