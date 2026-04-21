# Macro MCP Server — Single-Slide Content

Copy the block below into a PowerPoint slide. Everything is plain text / bullets
that paste cleanly with PPT's "Keep Text Only" option.

---

## TITLE
**Macro MCP Server**

## SUBTITLE / TAGLINE
AI agents that scaffold, import, and explore — without asking you how the monorepo works

---

## BODY — three columns

### 🛠  TOOLS (11) — do things
- **import_figma_app** — zip → registered OpenFin React app, one call
- **amps_create_mfe** — live AMPS topic → Angular/React MFE with AG Grid
- **amps_explore** — inspect topics, SOW queries, detected schema
- **scaffold_angular_app / scaffold_react_app / scaffold_library**
- **register_openfin_app** — Home + Dock + Store in one shot
- **list_icons / list_libraries / get_library_api / get_commands**

### 📚  RESOURCES (12) — know things
Served over `macro://` — zero tokens spent re-deriving conventions
- architecture · tech-stack · libraries
- theming · openfin · data-connectivity
- market-data-server · testing · lob-guide
- figma-workflow · templates/angular · templates/react

### ✨  PROMPTS (6) — start things
Canned prompt templates the agent can autocomplete
- create-angular-app / create-react-app
- add-grid-component · add-fdc3-context
- add-theme-support · add-data-connectivity

---

## FOOTER BAND — the pitch (one line)
**From "Figma zip" to running OpenFin view in a single tool call** — port wired,
dependencies installed, manifests + Dock + Store registered, icons picked,
start script added. No manual steps.

## BOTTOM-RIGHT CHIP
`.mcp.json` → works in Claude Code, Cursor, VS Code Copilot, JetBrains

---

## SUGGESTED LAYOUT

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Macro MCP Server                                                        │
│  AI agents that scaffold, import, and explore — without asking how       │
├──────────────────────┬──────────────────────┬───────────────────────────┤
│  🛠 TOOLS (11)       │  📚 RESOURCES (12)   │  ✨ PROMPTS (6)            │
│  do things           │  know things         │  start things             │
│                      │                      │                           │
│  • import_figma_app  │  • architecture      │  • create-angular-app     │
│  • amps_create_mfe   │  • tech-stack        │  • create-react-app       │
│  • amps_explore      │  • libraries         │  • add-grid-component     │
│  • scaffold_*        │  • theming           │  • add-fdc3-context       │
│  • register_openfin  │  • openfin           │  • add-theme-support      │
│  • list_icons        │  • data-connectivity │  • add-data-connectivity  │
│  • list_libraries    │  • figma-workflow    │                           │
│  • get_library_api   │  • templates/*       │                           │
│  • get_commands      │  • lob-guide         │                           │
├──────────────────────┴──────────────────────┴───────────────────────────┤
│  From "Figma zip" → running OpenFin view in a SINGLE tool call           │
│  Port wired · deps installed · Home/Dock/Store registered · icons picked │
└─────────────────────────────────────────────────────────────────────────┘
    Works in Claude Code · Cursor · VS Code Copilot · JetBrains (via .mcp.json)
```

---

## KEY NUMBERS (for a callout box)
- **11** tools that mutate the repo
- **12** read-only reference docs
- **6** canned prompt templates
- **144** Capital Markets icons (dark + light variants)
- **1** tool call to go from zip → live app
