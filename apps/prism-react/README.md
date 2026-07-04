# Prism Blotter (React)

The React build of **Prism — Blotter as a Service** (port **4205**), consuming the shared `@macro/prism-core` + `@macro/macro-react-grid`.

Quick start:

```bash
npm install --legacy-peer-deps
npm run prism:brokers      # local NATS / JetStream / Solace (Docker)
npm run prism:feed         # publish simulated market data
npm run start:prism-react  # http://localhost:4205
```

No Docker? `npx nx serve market-data-server` feeds the two plain-WebSocket **WS UST** catalog
sources (table protocol on `ws://localhost:3000/prism`).

Full docs (sources, modes, AMPS, OpenFin, architecture, troubleshooting): see [`apps/prism/README.md`](../prism/README.md).
