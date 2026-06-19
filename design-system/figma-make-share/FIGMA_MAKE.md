# Macro Design System — Figma Make context

> Paste this whole document into Figma Make as context, then describe the screen you want
> (e.g. "a rates blotter with a working-orders panel"). Figma Make will generate UIs that
> match the Macro design system. All values below are concrete — no external files needed.

Macro is a **dark-default, information-dense design system for a front-office rates
e-trading platform** (traders, sales traders, middle office). It is tuned for screens that
stream fast-ticking prices across dense data grids. Think: Bloomberg-terminal density with
a modern, Linear/Retool-clean execution.

---

## 1. Core principle: glanceability over decoration

- Dense, calm, fast. No gradients, no shadows-as-decoration, no emoji, no illustration.
- **Borders express hierarchy**, not shadows. 1px hairlines everywhere.
- Every number is monospaced + tabular so columns align on the decimal.
- **Green/red are SACRED — directional only** (price up/down, P&L, bid/ask). Never use
  green for "success" or red for "error" in the data area; use neutral status pills instead.

---

## 2. Color tokens (concrete hex — dark theme, the default)

### Surfaces (darkest → lightest)
| Token | Hex | Use |
|---|---|---|
| bg-app | `#0b0d12` | App chrome / outermost |
| bg-canvas | `#12141a` | Default content background |
| bg-panel | `#181b22` | Cards, panels |
| bg-raised | `#1e222a` | Menus, popovers, tickets |
| grid-hover | `#22262f` | Row hover |
| grid-selected | `#1a2a3f` | Selected row (cool blue tint) |

### Text
| Token | Hex | Use |
|---|---|---|
| fg-1 | `#e6e8ec` | Primary text |
| fg-2 | `#a8afbd` | Secondary / labels |
| fg-3 | `#6f7687` | Tertiary / captions |
| fg-4 | `#4a5060` | Disabled / placeholder |

### Borders
| Token | Hex |
|---|---|
| border-1 (default separators) | `#2a2f39` |
| border-2 (stronger edges) | `#363c48` |
| border-grid (cell borders, barely visible) | `#1c2029` |

### Brand — "Macro Cerulean" (cool steel blue)
| Token | Hex | Use |
|---|---|---|
| brand | `#2aa6e6` | CTAs, active tabs, focus rings, live-price dot |
| brand-hover | `#55b2ee` | Hover |
| brand-press | `#1685c2` | Press |
| brand-soft | `rgba(42,166,230,0.14)` | Selected item bg, range selection |
| on-brand | `#041a26` | Text on a brand fill |

**Brand is never used in data.** It is chrome only.

### Market / directional (the most important colors in the system)
| Token | Hex | Use |
|---|---|---|
| mkt-up / bid | `#34d97a` | Price up, positive P&L, bid |
| mkt-up-bg | `rgba(52,217,122,0.14)` | Up cell background |
| mkt-up-flash | `rgba(52,217,122,0.42)` | Tick-up flash peak |
| mkt-down / ask | `#ff6b64` | Price down, negative P&L, ask |
| mkt-down-bg | `rgba(255,107,100,0.14)` | Down cell background |
| mkt-down-flash | `rgba(255,107,100,0.42)` | Tick-down flash peak |

### Status (non-directional — for pills, toasts, connection state)
| Token | Hex |
|---|---|
| info | `#5b8def` |
| warn | `#f5c13a` |
| error | `#ff6b64` |
| ok / live | `#34d97a` |
| stale | `#f5c13a` |
| halted | `#ff6b64` |

### Light theme (optional override)
Surfaces invert: app `#eceef2`, canvas `#ffffff`, panel `#f6f7f9`, selected `#e2ecff`.
Text: fg-1 `#12141a`, fg-2 `#3b414c`, fg-3 `#7b8392`. Borders: border-1 `#e1e4ea`.
Brand darkens to `#1685c2`. Directional colors darken for white legibility:
mkt-up `#0f7f45`, mkt-down `#b82c25`.

---

## 3. Typography

- **Sans (everything except numbers):** `Roboto Condensed` — buys ~10-12% more horizontal
  density, fits more columns. Weights 400 / 500 / 700. Fallback: system-ui.
- **Mono (every number — prices, sizes, P&L, timestamps, IDs):** `IBM Plex Mono`,
  with tabular lining figures. Weights 400 / 500.
- No serif, no display faces, nothing lighter than 400.

### Type scale (compact, trading-appropriate)
| Role | Size / weight |
|---|---|
| Display h1 | 32px / 600 |
| h2 | 24px / 600 |
| h3 | 20px / 500-600 |
| h4 | 16px / 500-600 |
| Body (emphasized) | 14px / 400 |
| Body (comfortable) | 13px / 400  ← default |
| Body (default) | 12px / 400 |
| Grid rows / dense | 11px / 400 mono |
| Label | 10px / 500, ALL CAPS, letter-spacing 0.06em, color fg-3 |

No text below 10px. Section headers are the 10px ALL-CAPS label, not body text.

---

## 4. Spacing, radii, shadows, motion

- **Spacing base 2px:** 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64.
  Grid cells: 4px horizontal padding, **22px row height**. Panels abut with a 1px border, no gap.
- **Radii:** inputs/cells/pills `3px`, buttons/tabs `5px`, panels/cards `8px`, modals `12px`,
  status dots & tag pills `999px`.
- **Shadows (minimal — 3 levels):** panel = 1px hairline only; popover = `0 4px 12px rgba(0,0,0,.45)`;
  modal = `0 12px 32px rgba(0,0,0,.55)`. Never inner glow, never glassmorphism, never backdrop-blur.
- **Motion:** fast, functional, no bounces. 80-260ms, ease-out. The one signature motion is the
  **price-tick flash**: a 600ms linear fade of a cell's background from the flash color to
  transparent. No skeleton shimmer (reads as a ticking price).

### Control heights (density anchor)
grid row 22px · grid header 26-28px · control sm 24px · control md 28px · control lg 32px.
Provide a density toggle: tight (20px rows) / default (22px) / cozy (32px).

---

## 5. Component recipes

**Buttons**
- Primary: brand fill `#2aa6e6`, text `#041a26`, radius 5px, padding 5×12, 12px/500. Hover → `#55b2ee`.
- Secondary/ghost: transparent, 1px `#363c48` border, text `#e6e8ec`. Hover → bg `#22262f`.
- Bid button: bg `rgba(52,217,122,.12)`, border `#0a5c32`, text `#6ee7a8`.
- Ask button: bg `rgba(255,107,100,.12)`, border `#861e19`, text `#ff9a95`.
- Destructive: red-tinted (bg `#3a0f0c`, text `#ff9a95`).
- Press: translateY(1px). Focus: 2px cerulean outline offset 2px.

**Inputs**
- bg `#12141a`, 1px `#363c48` border, 3px radius, 12px mono for numerics, min-height 28px.
- Focus: border `#2aa6e6` + 2px `rgba(42,166,230,.14)` ring. Placeholder fg-4.
- Side toggle (Buy/Sell): segmented, Buy=green-tinted, Sell=red-tinted.

**Data grid (the centerpiece)**
- Header: bg `#181b22`, fg-3, 10px ALL-CAPS, sticky. Rows 22px, alternating bg `#181b22`.
- Cell border `#1c2029`. Hover row `#22262f`. Selected row `#1a2a3f` + 2px brand left stripe.
- First column often pinned left. Numbers right-aligned, mono, tabular.
- Bid column green, ask column red, change column green/red by sign.
- Live cells flash on update (600ms fade). Status pill per row.

**Status pills** (rounded 999px, 10-11px): `● Working` / `● Filled` green-tinted,
`● Pending`/`● Stale` yellow-tinted, `● Rejected`/`● Halted` red-tinted, `● Cancelled` neutral,
`● Routed` blue-tinted. The `●` dot inherits the text color.

**Tags** (venues, tenors): 3px radius, mono 10px, bg `#1e222a`, 1px border `#363c48`, fg-2.

**Tabs:** underline style — active tab gets a 2px brand bottom border + fg-1; inactive fg-2.
Counts shown in mono fg-3 next to the label.

**Panels/cards:** bg `#181b22`, 1px `#2a2f39` border, 8px radius, NO drop shadow. A 24-26px
header bar (10px ALL-CAPS label, optional actions right-aligned).

**Tickets (order/RFQ):** right-side drawer (not modal) for contextual detail. Keyboard-first:
⌘⏎ submit, esc cancel, ↑↓ step price.

---

## 6. Layout rules

- Fixed app chrome: top nav ~40px, optional left rail 48-56px, status bar ~24px bottom.
- Resizable dock splits between panels — 1px `#363c48` divider, 6px drag gutter.
- Grids virtualized, headers sticky, first column pinned.
- Right-side drawer for contextual data (order ticket, trade detail). Modals ONLY for
  destructive confirms and first-run setup.
- Modal backdrop `rgba(6,8,12,0.72)`, no blur.

---

## 7. Copy & content rules

- **Terse, literal, verb-first.** No marketing voice, no exclamation marks, no apologies.
  - ✅ `Filled 5MM @ 4.238` · `Rejected — credit limit exceeded. Reduce size or route to voice.`
  - ❌ `Great! Your order was submitted successfully 🎉`
- **Casing:** column headers / section labels = ALL CAPS. Buttons / status pills = Sentence case.
  Never Title Case. Instrument names as the market writes them: `USD 10Y SOFR`, `DBR 2.1 02/34`.
- **Numbers:** prices 4dp for rates (`4.2385`), 2dp for bond prices (`99.42`). Size with K/MM/BN
  suffixes (`25MM`, never `25,000,000`). P&L signed with Unicode minus: `+$12.4K` / `−$3.2K`.
- **No emoji, ever.** Directional state uses colored ▲▼ triangles, never 🔺🔻.
- **House vocabulary:** Working/Filled/Cancelled/Rejected (not Pending/Success/Failed/Error);
  Submit order (not Place order); Send RFQ (not Request quote); Size (not Quantity); Hit/Lift
  on trader screens, Buy/Sell on sales screens.

---

## 8. Iconography

Lucide icon set, 16px default, 1.5px stroke, currentColor, fill none. SVG only — no icon font,
no emoji, no PNG. Only two Unicode glyphs allowed: ▲▼ (price direction) and ● (status dots).

---

## 9. Example prompt to give Figma Make after pasting this

> "Using the Macro design system above, design a **rates blotter screen**: a fixed top nav with
> the Macro wordmark and tabs (Blotter, Watchlist, Orders 12, Trades); a left watchlist rail; a
> dense price grid with columns Instrument (pinned), Tenor, Bid (green), Ask (red), Last, Chg
> (green/red by sign), Venue, Status pill, and inline Bid/Ask/RFQ buttons; and a bottom
> working-orders panel split by a draggable divider. Dark theme, 22px rows, IBM Plex Mono for all
> numbers, Roboto Condensed everywhere else. Bottom status bar showing connection + P&L + DV01."
