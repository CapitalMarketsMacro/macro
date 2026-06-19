# Share Macro in Figma Make

Three files, three ways to use them. Figma Make works from **pasted context** — it
doesn't import a Figma library — so the goal here is to give its AI everything it
needs in text + code form.

## Files
- **FIGMA_MAKE.md** — the master brief. Every token as a concrete value, component
  recipes, layout rules, copy guidelines, and an example prompt. This is the one that matters.
- **macro-reference.html** — a self-contained visual board (open in any browser). Doubles as
  paste-able reference code and a screenshot source.
- **macro.min.css** — the single-file stylesheet, if you'd rather Figma Make work from real CSS.

## How to use in Figma Make

### Option A — paste the brief (recommended)
1. Open Figma Make, start a new make.
2. Paste the **entire contents of FIGMA_MAKE.md** as your first message / context.
3. Then prompt what you want, e.g.
   > "Using the Macro design system above, design an order ticket with a Buy/Sell toggle,
   > size and limit-price fields, a venue multi-select, and a live mid-price readout."
4. Iterate. Because every color/size is concrete, output stays on-brand.

### Option B — show it the reference board
1. Open **macro-reference.html** in a browser, screenshot it (or the relevant section).
2. In Figma Make, attach the screenshot and say "match this visual system."
3. Combine with Option A for best fidelity (brief = rules, screenshot = look).

### Option C — feed it the CSS
1. Paste **macro.min.css** and say "use these CSS variables and component classes."
2. Best when you want Figma Make to emit code that imports the real stylesheet.

## Tips for good output
- Lead every prompt with "Using the Macro design system…" so it keeps the rules in scope.
- Re-paste FIGMA_MAKE.md if a long session drifts off-brand.
- Remind it of the two sacred rules if they slip: **green/red = directional only**, and
  **every number is mono + tabular**. These are the fastest tells that output is off-brand.
- Ask for dark theme explicitly — Macro is dark-default but Make may assume light.

## Keeping it in sync
If the design system changes (new brand color, new component), regenerate FIGMA_MAKE.md
and macro-reference.html from the source project and re-share. They are the single source
of truth for Figma Make — there is no live link back to the project.
