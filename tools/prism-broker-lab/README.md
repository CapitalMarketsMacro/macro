# Prism broker lab

Local **AMPS / NATS / Solace** brokers + a data feeder for testing the **Prism — Blotter as a Service** app (`apps/prism`). The seeded catalog in `apps/prism/public/data-sources.json` is pre-wired to these ports, so live data shows up with no edits.

## Quick start

```bash
# 1. start the brokers (NATS + Solace)
npm run prism:brokers              # docker compose up -d
#    Solace takes ~30–60s to come up; check: docker compose -f tools/prism-broker-lab/docker-compose.yml ps

# 2. publish simulated data to NATS (core + JetStream) and Solace
npm run prism:feed                 # node tools/prism-broker-lab/feeder.mjs  (Ctrl-C to stop)

# 3. run Prism and open a source
npm run start:prism                # http://localhost:4204
#    Open: "NATS FX Quotes", "JetStream Positions", "NATS Analytics", "Solace UST Prices"

# stop the brokers
npm run prism:brokers:down         # docker compose down   (add -v to wipe volumes)
```

Requires Docker (Desktop on Windows) and Node 18+ (Node 22+ has a built-in `WebSocket`; on older Node the feeder shims it from the `ws` package).

## Ports (match the seeded catalog)

| Broker | Endpoint Prism uses | Other ports |
| --- | --- | --- |
| NATS (core + JetStream) | `ws://localhost:9222` (WebSocket) | 4222 client, 8222 monitor |
| Solace PubSub+ | `ws://localhost:8008` (web messaging) | 55555 SMF, **8080 admin UI** (admin/admin) |
| AMPS | `ws://localhost:9008/amps/json` | — (see below) |

Browsers/OpenFin can only reach NATS over its **WebSocket** listener (9222), not the TCP client port (4222) — that's why `nats.conf` enables `websocket`.

## What the feeder publishes

| Catalog source | Subject / topic | Mode | Key |
| --- | --- | --- | --- |
| NATS FX Quotes | `macro.fx.quotes.<symbol>` | streaming (250ms) | `symbol` |
| NATS Analytics | `macro.analytics.events` | append | — |
| JetStream Positions | `macro.positions.<bookId>` (stream `POSITIONS`, last-per-subject) | snapshot-update | `bookId` |
| Solace UST Prices | `ust/prices/<cusip>` | streaming (300ms) | `cusip` |

Field names are chosen so Prism's column inference applies capital-markets formatting (bid/ask/mid→price, spread→bps, changePercent→coloured %, qty→grouped int, pnl→coloured, yield/coupon→%, cusip/symbol/bookId→text/pinned).

Feeder env (optional): `NATS_WS`, `SOLACE_URL`, `SOLACE_VPN`, `SOLACE_USER`, `SOLACE_PASS`, and `FEED=nats,js,solace` to enable a subset.

## AMPS

AMPS is commercial — there is **no public Docker image**, so it is not in `docker-compose.yml`. You already run an AMPS instance on Linux:

1. Make sure its **websocket/json transport** is reachable (default `…/amps/json`) and it has SOW-enabled topics (the catalog expects `fx_spot` keyed by `symbol`, and `orders`).
2. Point the catalog's AMPS entries at it — edit `connection.url` in `apps/prism/public/data-sources.json` (e.g. `ws://<your-linux-host>:9008/amps/json`) **or** just use Prism's **Add ad-hoc source** dialog at runtime.

To run AMPS in Docker instead, uncomment the `amps` service in `docker-compose.yml` with your licensed image + a config exposing the ws/json transport on 9008.

## Notes / troubleshooting

- **Solace from Node**: `solclientjs` is browser-oriented; the feeder uses its Node build with a `WebSocket` global. If Solace publishing fails, the feeder logs it and keeps feeding NATS — you can still test Solace by publishing `ust/prices/<cusip>` from another tool, or use the Solace **Try-Me!** page at `http://localhost:8080`.
- **JetStream snapshot** uses `DeliverPolicy.LastPerSubject`, which is only a correct blotter snapshot when each subject maps 1:1 to a key — the lab stream uses `subjects: ["macro.positions.>"]` with `max_msgs_per_subject: 5`, so the last message per `bookId` is the snapshot.
- **`https`**: over plain `http://localhost` the `ws://` URLs are fine; if you serve Prism over `https`, switch the catalog to `wss://` (and configure TLS on the brokers).
