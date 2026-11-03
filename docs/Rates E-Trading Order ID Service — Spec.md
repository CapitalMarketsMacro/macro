# Rates E-Trading Order ID Service — Spec

Nov 3, 2026 · @Mrudang Majmudar

## 1. Overview and goals

Every new order from any Macro Desktop MFE carries a 53-bit integer ID that is unique for its trading day. Views mint IDs locally from a block leased over NATS, so order entry never waits on a network call.

**Requirement.** Each new order sent from the Rates e-trading front end carries a `long` order ID that is unique within a trading day across all users, machines, and views.

**Context.** The front end is an OpenFin Workspace platform. A user runs up to 50 views (30+ ladders, order tickets, blotters), each in its own JS context and renderer process. Every MFE already holds its own NATS WebSocket connection.

**Goals**

- Unique per trading day, guaranteed by construction rather than by probability.
- Zero added latency on order submit: no IPC, lock, or network call to obtain an ID.
- Safe across view reloads, crashes, multiple machines per user, and day roll.
- Fits in 53 bits, so it is a plain JS `number` and a valid Java `long`.
- Retries of the same order reuse the same ID; JetStream drops duplicates.

**Non-goals**

- A gapless sequence. Abandoned lease space leaves gaps by design.
- A globally time-ordered sequence across views. IDs increase within a lease only.
- An official OMS sequence number. If compliance needs gapless or globally ordered numbers, the OMS assigns them as a separate field.

## 2. Architecture

NATS carries only three things: lease requests at view boot and refill, the start-of-day roll, and orders. The order ID itself is computed inside each view.

&#91;embedded content: architecture · views, NATS, lease service, OMS\]

A view leases a block at boot; the lease service CAS-increments the day key, audits the grant, and replies. From then on `nextId()` is local until the next refill or the SOD roll.

## 3. ID format

The order ID is `day (15 bits) | lease (22 bits) | counter (16 bits)`, a 53-bit unsigned integer that never exceeds `Number.MAX_SAFE_INTEGER`.

| Field | Bits | Range | Set by | Meaning |
| --- | --- | --- | --- | --- |
| day | 15 (bits 52–38) | 0–32,767 (\~89 years) | Lease service | Days from epoch 2025-01-01 to the trade date |
| lease | 22 (bits 37–16) | 0–4,194,303 per day | Lease service (KV CAS) | Block number within the trade date; starts at 1 |
| counter | 16 (bits 15–0) | 0–65,535 per lease | Client library | Increments per order inside the view |

```latex
\mathrm{orderId} = \mathrm{day} \cdot 2^{38} + \mathrm{lease} \cdot 2^{16} + \mathrm{counter}
```

Worked example: trade date 2026-11-03 is day 671, lease 1842, counter 17 → `184443196276753`. The maximum value, all fields full, equals 2^53 − 1 exactly.

**Encoding rules**

- Compose with multiplication and addition, never bitwise operators. JS `<<` and `|` truncate to 32 bits.
- JSON carries the ID as a number. It is safe because it is below 2^53. Downstream Java reads it as `long`.
- Binary transports (protobuf, SBE) use `int64`/`uint64`. Use `DataView.setBigUint64(BigInt(id))` or Long.js; never round-trip through `float64` libraries that reformat.
- Display format for ops and support: `YYYYMMDD-lease-counter`, e.g. `20261103-1842-17`. It is derived from the ID, never sent instead of it.
- The `day` field comes only from the lease response. The client clock never sets it.

**Capacity check**

- 4.19M leases per day covers 50 views × 2,000 users × 40 reloads with ample headroom.
- 65,536 orders per lease is far above a human ticket's daily volume. Algo or auto-quoting views may need a smaller counter and more lease bits; see open questions.
- Decoding: `day = Math.floor(id / 2**38)`, `lease = Math.floor(id / 2**16) % 2**22`, `counter = id % 2**16`.

## 4. NATS design

One KV bucket holds the per-day lease counters, one stream logs every lease for audit, and clients only ever request leases and publish orders.

**Subjects**

| Subject | Pattern | Publisher → subscriber | Payload |
| --- | --- | --- | --- |
| `rates.idlease.request` | Request-reply | MFE → lease service (queue group `idlease`) | `LeaseRequest` |
| `rates.idlease.audit.{tradeDate}` | JetStream publish | Lease service → `ID_LEASE_AUDIT` stream | `LeaseGranted` |
| `rates.sod.roll` | Core pub-sub | Lease service → all MFEs | `TradeDateRoll` |
| `rates.orders.new.{userId}` | JetStream publish, `Nats-Msg-Id` = order ID | MFE → `RATES_ORDERS` stream → OMS | Order |

**KV bucket `ID_LEASES`**

- Key `day.{YYYYMMDD}`, value = last granted lease number as a decimal string.
- Key `current`, value = active trade date as `YYYY-MM-DD`. Only the SOD job writes it.
- `history: 1`, `storage: file`, `replicas: 3`, `ttl: 7d` (old day keys expire on their own).
- Updates are CAS: `update(key, value, revision)`.

**Stream `ID_LEASE_AUDIT`**

- Subjects `rates.idlease.audit.>`, `retention: limits`, `max_age: 400d` (adjust to the retention policy), `replicas: 3`.
- One message per lease: who held which block, from which host and view.

**Stream `RATES_ORDERS`** (if orders ride JetStream)

- `duplicate_window: 10m`, covering the worst-case reconnect plus retry time.
- The OMS consumes with a durable pull consumer and also dedupes on order ID as the final guarantee.

**Permissions** (JWT/NKeys or auth callout)

| Principal | Publish | Subscribe |
| --- | --- | --- |
| MFE user | `rates.idlease.request`, `rates.orders.new.{ownUserId}` | `_INBOX.>`, `rates.sod.roll` |
| Lease service | `rates.idlease.audit.>`, `rates.sod.roll`, `$KV.ID_LEASES.>`, replies | `rates.idlease.request` |
| OMS | replies only | `RATES_ORDERS` consumer |

Clients never get KV or stream-admin rights. Nobody but ops can delete `ID_LEASES` or `ID_LEASE_AUDIT`.

## 5. Lease service

A stateless Java 21 / Spring Boot service using jnats grants leases by CAS-incrementing the day key, and runs as 2+ instances in queue group `idlease`.

**Request** on `rates.idlease.request`:

```json
{ "userId": "u123", "viewId": "ladder-ust10y-7", "viewType": "ladder",
  "host": "WSNY0423", "clientVersion": "1.4.0", "requestId": "uuid" }
```

**Reply**:

```json
{ "ok": true, "tradeDate": "2026-11-03", "day": 671, "lease": 1842,
  "counterBits": 16, "grantedAt": "2026-11-03T13:40:02.118Z" }
```

Error reply: `{ "ok": false, "code": "NOT_ENTITLED" | "RATE_LIMITED" | "DAY_EXHAUSTED" | "ROLL_IN_PROGRESS" | "INTERNAL", "message": "…" }`.

**Grant algorithm**

1. Validate the request: user entitled for Rates order entry, per-user rate limit (default 120 leases per minute).
2. Read KV `current` for the trade date. If it is missing, or a roll is in progress, reply `ROLL_IN_PROGRESS`.
3. `get(day.{YYYYMMDD})` → value `v`, revision `r`. Missing → `create(key, "1")`; a `create` conflict means another instance won, so go back to the get.
4. `update(key, v + 1, r)`. On a wrong-revision error, retry from step 3 with jittered backoff, at most 10 attempts.
5. If `v + 1` exceeds 4,194,303, reply `DAY_EXHAUSTED` and alert.
6. Publish `LeaseGranted` to `rates.idlease.audit.{YYYYMMDD}` and wait for the PubAck, then reply. A lease is never handed out unaudited.

**Start of day (SOD) roll**

- A scheduled job, or an ops command, sets the new trade date. The roll time is a config value per desk calendar, not midnight.
- Steps: write KV `current` = new date → publish `TradeDateRoll { previous, current, effectiveAt }` on `rates.sod.roll`.
- The new day key starts empty, so the first grant of the day is lease 1.
- Holidays and weekends come from the desk's trading calendar. The service never derives a trade date from the wall clock.

**Non-functional**

- p99 grant latency < 10 ms in-region; KV CAS contention is limited to boot storms.
- Stateless: any instance can serve any request; all state lives in `ID_LEASES`.
- Health endpoint reports NATS connection, KV reachability, and current trade date.

## 6. Client library (`@macro/order-id`)

A TypeScript package every MFE instantiates once at boot; `nextId()` is synchronous and never touches the network.

**Public API**

```ts
export interface OrderIdOptions {
  nc: NatsConnection;            // the MFE's existing nats.ws connection
  userId: string; viewId: string; viewType: 'ladder' | 'ticket' | 'other';
  refillAt?: number;             // fraction of counter used before prefetch, default 0.8
  requestTimeoutMs?: number;     // default 2000
}

export type IdState = 'INIT' | 'READY' | 'REFILLING' | 'ROLLING' | 'EXHAUSTED' | 'CLOSED';

export interface OrderIdGenerator {
  start(): Promise<void>;        // leases the first block; rejects if it cannot
  nextId(): number;              // sync; throws OrderIdUnavailable unless READY or REFILLING
  readonly state: IdState;
  readonly tradeDate: string;    // 'YYYY-MM-DD' from the lease
  onStateChange(cb: (s: IdState) => void): () => void;
  close(): void;
}

export function createOrderIdGenerator(o: OrderIdOptions): OrderIdGenerator;
export function decodeOrderId(id: number): { day: number; tradeDate: string; lease: number; counter: number };
export function formatOrderId(id: number): string; // '20261103-1842-17'
```

**States**

| State | Meaning | `nextId()` | Moves to |
| --- | --- | --- | --- |
| INIT | No lease yet | throws | READY after first grant |
| READY | Active lease, counter below `refillAt` | returns ID | REFILLING at threshold; ROLLING on `rates.sod.roll` |
| REFILLING | Next lease requested in background | returns ID | READY when next lease is buffered; EXHAUSTED if counter runs out first |
| ROLLING | Trade date changed; old lease discarded | throws | READY when new-day lease arrives |
| EXHAUSTED | Counter full and no next lease | throws | READY when a lease arrives |
| CLOSED | View shutting down | throws | — |

**Rules**

- `nextId()` returns `day·2^38 + lease·2^16 + counter`, then increments the counter. Arithmetic only, no bitwise ops.
- At `counter ≥ refillAt × 65,536`, request the next lease once; buffer it; swap when the counter hits 65,536.
- Never persist or reuse a lease. A reload, crash, or new window always calls `start()` again.
- On NATS disconnect, keep minting from the current lease. Only refills need the connection.
- Lease request retries: 3 attempts, backoff 200 ms / 800 ms / 2 s, then stay in the current state and emit an error event.
- On `rates.sod.roll`: discard current and buffered leases, go to ROLLING, lease for the new date.
- The order ticket UI binds to `onStateChange`: disable the submit button outside READY/REFILLING and show "Order IDs unavailable".
- One generator per view. Never share one across views through IAB or the Channel API.

## 7. Order submission and idempotency

The ID is minted once, when the trader commits the order, and every retry of that order reuses it.

1. Trader clicks Submit → ticket calls `nextId()` and freezes the order payload with `orderId` and `tradeDate`.
2. Write `{orderId, payload, status: 'PENDING'}` to IndexedDB in the view's origin.
3. `js.publish('rates.orders.new.{userId}', payload, { msgID: String(orderId), timeout: 2000 })`.
4. PubAck received → status `SENT`. `pa.duplicate === true` means an earlier attempt already landed; treat as sent.
5. Timeout or disconnect → retry the same payload and `msgID` (backoff 250 ms, 1 s, 3 s) within the duplicate window.
6. OMS ack or reject on the order's own reply subject → status `ACKED` / `REJECTED`; remove from IndexedDB after the ack.
7. On view restart: for any `PENDING`/`SENT` rows, query the OMS by `orderId` before showing the ticket as clear. Never resubmit blindly after a restart.

**Payload fields this spec adds**

| Field | Type | Example |
| --- | --- | --- |
| `orderId` | number (int64 server side) | `184443196276753` |
| `tradeDate` | string `YYYY-MM-DD` | `2026-11-03` |
| `clientSubmitTs` | ISO-8601 UTC | `2026-11-03T18:40:05.221Z` |
| `viewId` | string | `ladder-ust10y-7` |

The OMS rejects an order whose `tradeDate` disagrees with the `day` field decoded from `orderId`, or whose `tradeDate` is not the current one.

## 8. Failure modes

Every failure either keeps minting from a valid lease or stops order entry visibly; no path reuses an ID.

| Failure | Detection | Behaviour |
| --- | --- | --- |
| NATS disconnect mid-day | `nc.status()` events | Keep minting from current lease; refill waits for reconnect; EXHAUSTED disables submit |
| Lease service down at view boot | Request timeout ×3 | View stays INIT; ticket shows "Order IDs unavailable"; retry every 5 s |
| Lease service crash after KV update, before reply | Client timeout | Client retries and gets a new lease; the orphaned one is a harmless gap (audit shows no grant if PubAck never happened) |
| KV CAS storm at login (2,000 users × 50 views) | CAS retry count metric | Jittered retries; stagger view boot by 0–2 s; optionally the platform provider pre-warms leases |
| View reload or crash | New JS context | New `start()`, new lease; IndexedDB reconciliation for pending orders |
| Same user on two machines | — | Each view leases independently; no conflict |
| SOD roll while ticket is open | `rates.sod.roll` | ROLLING; submit disabled until the new lease lands (target < 1 s) |
| Order submitted just before roll, retried after | OMS date check | Retry keeps old ID and old `tradeDate`; OMS policy decides accept or reject (open question) |
| Missed roll event (view offline at roll) | Lease `tradeDate` ≠ KV `current` on reconnect | On reconnect, client re-checks via a lease request; service replies with the new date |
| `ID_LEASES` bucket lost or recreated | Day key value lower than audit stream's last lease | Service refuses grants until ops restores; restore = set day key to max lease seen in `ID_LEASE_AUDIT` |
| Client clock wrong | — | No effect; date and day come from the server |
| Day exhausted (4.19M leases) | `DAY_EXHAUSTED` | Page ops; indicates a reload loop or bug, not real volume |

## 9. Observability, config, tests and build plan

**Metrics** (Micrometer on the service, OpenFin logger + a metrics subject on the client)

- `idlease_grants_total{tradeDate}`, `idlease_cas_retries`, `idlease_grant_latency_ms` (p50/p99), `idlease_errors_total{code}`.
- Client: `orderid_state` transitions, `orderid_refill_latency_ms`, `orderid_exhausted_total`, `orderid_unavailable_ms` (time submit was disabled).
- Alerts: any `DAY_EXHAUSTED`; error rate > 1% over 5 min; a user exceeding 200 leases in a day (reload loop).

**Config**

| Key | Default | Owner |
| --- | --- | --- |
| `idlease.epoch` | `2025-01-01` (fixed forever) | Platform |
| `idlease.counterBits` | 16 | Platform |
| `idlease.rateLimitPerUserPerMin` | 120 | Lease service |
| `idlease.sodRollTime` | per desk calendar, e.g. `17:00 America/New_York` | Ops |
| `orders.duplicateWindow` | 10m | NATS ops |
| `client.refillAt` | 0.8 | MFE |

**Acceptance tests**

- [ ] Unit: encode/decode round-trips at min, max, and random values; max equals 2^53 − 1; no value exceeds `Number.MAX_SAFE_INTEGER`.
- [ ] Unit: composing uses arithmetic; a test with lease ≥ 2^15 proves no 32-bit truncation.
- [ ] Concurrency: 50 service-side workers × 10,000 grants against a real NATS cluster (Testcontainers) → all leases distinct and contiguous from 1.
- [ ] Uniqueness soak: 2,000 simulated users × 50 generators × reloads for 1 hour → zero duplicate order IDs.
- [ ] Refill: counter crossing 80% triggers exactly one lease request; swap at 65,536 with no gap in availability.
- [ ] Disconnect: kill NATS for 60 s → minting continues; refill completes after reconnect.
- [ ] SOD roll: publish roll → every generator moves to ROLLING, then READY with new `tradeDate`; first new-day lease = 1.
- [ ] Idempotency: publish the same order 3 times with the same `msgID` → one stored message, PubAck `duplicate` on retries.
- [ ] Restart reconciliation: kill the view after publish, before ack → on reload the pending order is queried, not resent.
- [ ] Permissions: an MFE credential cannot write `$KV.ID_LEASES.>` or publish to another user's order subject.

**Open questions**

- Does compliance or the OMS need a gapless or globally ordered number? If yes, the OMS assigns it as a separate field.
- Policy for orders created before the roll and retried after: accept with old `tradeDate`, or reject?
- Exact roll time per desk (Rates NY vs London vs Asia) and the calendar source.
- Do any views auto-generate high order volume (algo, RFQ auto-responders) that could need more than 65,536 IDs per lease?
- Does the OMS field accept a 53-bit number as-is, or does a FIX `ClOrdID` mapping need the display format?

**Build plan for Devin / Claude Code**

1. Repo layout: `lease-service/` (Java 21, Spring Boot, jnats), `packages/order-id/` (TypeScript, `@nats-io/nats-core` + `@nats-io/jetstream` + `@nats-io/kv`), `infra/nats/` (stream and KV definitions as `nats` CLI JSON), `e2e/` (Testcontainers NATS).
2. `packages/order-id`: ID codec + unit tests first (section 3), then the generator state machine with a mocked lease client (section 6).
3. `infra/nats`: `ID_LEASES` bucket, `ID_LEASE_AUDIT` and `RATES_ORDERS` streams, and permission templates (section 4).
4. `lease-service`: request handler, CAS grant loop, audit publish, SOD roll job, metrics (section 5).
5. Wire the real lease client into the package; integration tests against NATS.
6. Order ticket integration: submit flow with `msgID`, IndexedDB pending store, reconciliation (section 7).
7. Soak and failure tests from the list above; dashboards and alerts.
