import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const THEMING_DOC = `# Macro Theming Architecture

## 3-Tier Theming System

### Tier 1: CSS Variables (\`@macro/macro-design\`)
All apps import shared CSS files that define OKLCH-based design tokens:

\`\`\`css
/* In styles.css */
@import '../../../libs/macro-design/src/lib/css/fonts.css';
@import '../../../libs/macro-design/src/lib/css/macro-design.css';
\`\`\`

**fonts.css** loads three Google Fonts:
- **Noto Sans** — body text (React apps)
- **Roboto** — AG Grid headers
- **Ubuntu** — AG Grid cells, body text (Angular apps)

**macro-design.css** defines CSS custom properties for light and dark modes:
\`\`\`css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.488 0.243 264.376);    /* #0A76D3 blue */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --border: oklch(0.922 0 0);
  --ring: oklch(0.488 0.243 264.376);
  /* ... sidebar, chart, card, destructive, muted, accent, etc. */
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.696 0.17 264.376);
  /* ... all dark overrides */
}
\`\`\`

### Tier 2: Dark Mode API (\`@macro/macro-design\`)
TypeScript utilities for managing dark/light mode:

\`\`\`typescript
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

// Read initial state (localStorage or system preference)
const isDark = getInitialIsDark();

// Apply mode (toggles .dark class on <html>, persists to localStorage)
applyDarkMode(isDark);

// Listen for OS color-scheme changes
const cleanup = onSystemThemeChange((isDark) => {
  applyDarkMode(isDark);
});
\`\`\`

### Tier 3: AG Grid Theme (\`@macro/macro-design\`)
AG Grid uses its own theming API. The \`buildAgGridTheme\` function creates a configured theme:

\`\`\`typescript
import { buildAgGridTheme, AG_GRID_FONTS } from '@macro/macro-design';

// Returns themeAlpine with colorSchemeDarkBlue/colorSchemeLight + Macro fonts
const theme = buildAgGridTheme(isDark);
\`\`\`

AG_GRID_FONTS: \`{ fontFamily: 'Noto Sans', headerFontFamily: 'Roboto', cellFontFamily: 'Ubuntu' }\`

Both \`MacroAngularGrid\` and \`MacroReactGrid\` handle this automatically — they watch
for \`.dark\` class changes on \`<html>\` via MutationObserver and rebuild the AG Grid theme.

## OpenFin Theme Config (\`@macro/macro-design\`)
The \`themeConfig\` export provides dark/light palettes for OpenFin workspace customization:

\`\`\`typescript
import { themeConfig, ThemeConfig, ThemePalette } from '@macro/macro-design';

// themeConfig.dark.brandPrimary === '#0A76D3'
// themeConfig.light.backgroundPrimary === '#FFFFFF'
\`\`\`

## Framework Integration

### PrimeNG (Angular)
\`\`\`typescript
providePrimeNG({
  theme: {
    preset: Aura,
    options: { darkModeSelector: '.dark' }  // <-- ties PrimeNG to same .dark class
  }
})
\`\`\`

### PrimeReact (React)
\`\`\`tsx
<PrimeReactProvider theme={{ preset: Aura, options: { darkModeSelector: '.dark' } }}>
  <App />
</PrimeReactProvider>
\`\`\`

### Tailwind CSS v4 (React)
The React app's \`styles.css\` maps CSS variables to Tailwind colors:
\`\`\`css
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  /* ... */
}
\`\`\`
This lets you use \`bg-background\`, \`text-primary\`, etc. — all driven by the same CSS variables.
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
