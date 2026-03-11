# Macro Front Office Transformation — Agentic AI for UI Modernization

## Summary

This initiative moves legacy .NET front-office screens into governed Angular/React micro frontends (MFEs) running inside Macro Desktop (OpenFin Workspace). An **agentic UI factory** combines Figma Make, a Macro MCP server, and Macro MFE libraries to accelerate screen delivery while embedding enterprise standards, auth, theming, and desktop integration from the start.

### Core Principles

- **Prompt-first** — faster screen ideation via AI-generated designs
- **Governed build** — Macro standards embedded automatically
- **Desktop-ready** — runs inside OpenFin Workspace out of the box

---

## Agentic UI Factory Pipeline

The factory follows six stages. AI handles repetitive UI work; Macro standards, libraries, and platform hooks keep output production-ready.

1. **Intake** — Capture the legacy screen, workflow, and success criteria
2. **Figma Make (AI Design)** — Generate first-pass UI with variants and flows
3. **Macro MCP Server (Govern)** — Apply guardrails, routes, and desktop hooks
4. **MFE Libraries (Compose)** — Wire in auth, logger, ag-Grid wrapper, themes, and shared components
5. **GitHub + OpenShift (Deploy)** — Create repo, open PR, run tests, build and deploy the release image
6. **Macro Desktop (Run)** — Host Angular/React MFEs in OpenFin Workspace (Storefront, Dock, color linking, FDC3, entitlements)

### Human Review Gates

> UX sign-off → Security / Auth → PR quality → Desktop UAT

### Key Benefits

- **Less greenfield coding** — boilerplate is scaffolded and reused
- **Standardized UX** — shared tokens and components keep parity
- **Fewer handoffs** — design-to-code moves in one flow
- **Desktop-ready delivery** — deployment and runtime hooks are built in

---

## Delivery Steps

| # | Owner | Phase | What Happens |
|---|-------|-------|--------------|
| 1 | Product + UX | Intake & prompt pack | Capture the legacy screen, workflow, success criteria, sample payloads, desktop context, and UX rules |
| 2 | AI + UX | Prototype in Figma Make | Generate first-pass screen, interaction states, and flows; iterate with product owner and business team |
| 3 | AI + Platform | Generate governed MFE repo | Use Macro MCP server to stamp the Angular/React shell; add routes, desktop hooks, shared patterns, and repo structure |
| 4 | Front-end Eng | Compose with Macro libraries | Apply auth, logger, ag-Grid wrapper, themes, and components; replace generic AI output with Macro behavior and events |
| 5 | Platform | Automate build & deployment | Push to GitHub, open PR, run tests, build release image; deploy to OpenShift and publish for validation |
| 6 | Desktop + Entitlements | Onboard into Macro Desktop | Register in Storefront and Dock; enable color linking / FDC3; configure entitlements and complete desktop UAT |

---

## Toolchain

| Tool | Role |
|------|------|
| **Figma Make** | AI-driven UI prototyping |
| **Macro MCP Server** | Guardrails, routes, desktop hooks |
| **Macro MFE Libraries** | Auth, logging, grid, theme, shared components |
| **GitHub** | Source control, PRs, CI checks |
| **OpenShift** | Container build and deployment |
| **OpenFin Workspace** | Desktop runtime (Storefront, Dock, FDC3) |
