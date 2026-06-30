/**
 * Prism broker-lab feeder — publishes simulated Capital Markets data to the lab brokers so the
 * Prism blotter shows live data immediately. Field names match Prism's column inference
 * (bid/ask/mid/spread/changePercent/qty/pnl/dv01/yield/coupon/price/cusip/symbol/bookId).
 *
 *   docker compose -f tools/prism-broker-lab/docker-compose.yml up -d   (or: npm run prism:brokers)
 *   node tools/prism-broker-lab/feeder.mjs                              (or: npm run prism:feed)
 *
 * Each broker runs independently — if one fails to connect, the others keep publishing.
 * Env: NATS_WS (ws://localhost:9222), SOLACE_URL (ws://localhost:8008), SOLACE_VPN/USER/PASS,
 *      FEED=nats,js,solace (subset to enable; default all).
 */

// NATS' wsconnect + solclientjs need a global WebSocket; Node 22+ has one, older needs the shim.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = (await import('ws')).WebSocket;
}

import { wsconnect } from '@nats-io/nats-core';
import { jetstream, jetstreamManager } from '@nats-io/jetstream';

const NATS_WS = process.env.NATS_WS ?? 'ws://localhost:9222';
const SOLACE_URL = process.env.SOLACE_URL ?? 'ws://localhost:8008';
const SOLACE_VPN = process.env.SOLACE_VPN ?? 'default';
const SOLACE_USER = process.env.SOLACE_USER ?? 'default';
const SOLACE_PASS = process.env.SOLACE_PASS ?? 'default';
const ENABLED = new Set((process.env.FEED ?? 'nats,js,solace').split(',').map((s) => s.trim()));

const rnd = (min, max) => min + Math.random() * (max - min);
const round = (n, dp) => Number(n.toFixed(dp));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cleanups = [];

// ── simulated data ────────────────────────────────────────────────────
const FX = ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCHF', 'USDCAD', 'NZDUSD', 'EURJPY', 'EURGBP', 'EURCHF'];
const fxMid = Object.fromEntries(FX.map((s) => [s, s.endsWith('JPY') ? rnd(120, 160) : rnd(0.6, 1.4)]));
function fxQuote(sym) {
  const jpy = sym.endsWith('JPY');
  const drift = (Math.random() - 0.5) * (jpy ? 0.05 : 0.0004);
  const mid = (fxMid[sym] = Math.max(0.01, fxMid[sym] + drift));
  const spread = jpy ? rnd(0.005, 0.02) : rnd(0.00002, 0.00008);
  const dp = jpy ? 3 : 5;
  return {
    symbol: sym,
    bid: round(mid - spread / 2, dp),
    ask: round(mid + spread / 2, dp),
    mid: round(mid, dp),
    spread: round(spread, dp),
    changePercent: round((Math.random() - 0.5) * 0.6, 4),
    updatedTime: new Date().toISOString(),
  };
}

const BOOKS = [
  { bookId: 'FX-SPOT', desk: 'FX', instrument: 'G10 Spot' },
  { bookId: 'RATES-GOVT', desk: 'Rates', instrument: 'UST Govvies' },
  { bookId: 'CREDIT-IG', desk: 'Credit', instrument: 'IG Cash' },
  { bookId: 'EM-LOCAL', desk: 'EM', instrument: 'EM Local' },
  { bookId: 'COMMOD', desk: 'Commodities', instrument: 'Energy' },
];
function position(book) {
  return {
    ...book,
    qty: Math.round(rnd(-5e7, 5e7)),
    pnl: round(rnd(-2e6, 2e6), 2),
    dv01: round(rnd(-50000, 50000), 0),
    updatedTime: new Date().toISOString(),
  };
}

const USTS = [
  { cusip: '912828YS3', coupon: 0.0125, maturity: '2027-06-30' },
  { cusip: '91282CAE1', coupon: 0.025, maturity: '2030-05-15' },
  { cusip: '912810TM0', coupon: 0.045, maturity: '2053-08-15' },
  { cusip: '91282CFK1', coupon: 0.04125, maturity: '2033-11-15' },
];
function ust(s) {
  const price = round(rnd(92, 108), 4);
  const spread = round(rnd(0.005, 0.03), 4);
  return {
    cusip: s.cusip,
    coupon: s.coupon,
    maturity: s.maturity,
    price,
    yield: round(s.coupon + rnd(-0.01, 0.01), 5),
    bid: round(price - spread / 2, 4),
    ask: round(price + spread / 2, 4),
    spread,
    changePercent: round((Math.random() - 0.5) * 0.4, 4),
  };
}

let analyticsSeq = 0;
function analytics() {
  return {
    id: `evt-${++analyticsSeq}`,
    type: pick(['view-opened', 'order-routed', 'fill', 'context-broadcast', 'snapshot']),
    user: pick(['atrader', 'bsmith', 'cwong', 'dpatel']),
    latencyMs: round(rnd(1, 250), 1),
    status: pick(['OK', 'OK', 'OK', 'WARN']),
    timestamp: new Date().toISOString(),
  };
}

function every(ms, fn) {
  const id = setInterval(fn, ms);
  cleanups.push(() => clearInterval(id));
}

// ── NATS core (streaming FX + append analytics) ─────────────────────────
async function startNatsCore(nc) {
  every(250, () => {
    const q = fxQuote(pick(FX));
    nc.publish(`macro.fx.quotes.${q.symbol}`, JSON.stringify(q));
  });
  every(1000, () => nc.publish('macro.analytics.events', JSON.stringify(analytics())));
  console.log('  ✓ NATS core: macro.fx.quotes.> (250ms), macro.analytics.events (1s)');
}

// ── NATS JetStream (snapshot-capable positions) ─────────────────────────
async function startJetStream(nc) {
  const jsm = await jetstreamManager(nc);
  try {
    await jsm.streams.add({ name: 'POSITIONS', subjects: ['macro.positions.>'], max_msgs_per_subject: 5 });
    console.log('  ✓ JetStream: created stream POSITIONS (subjects macro.positions.>, last-per-subject)');
  } catch {
    console.log('  ✓ JetStream: stream POSITIONS already exists');
  }
  const js = jetstream(nc);
  for (const b of BOOKS) await js.publish(`macro.positions.${b.bookId}`, JSON.stringify(position(b)));
  every(1000, () => {
    const b = pick(BOOKS);
    js.publish(`macro.positions.${b.bookId}`, JSON.stringify(position(b))).catch(() => undefined);
  });
  console.log('  ✓ JetStream: seeded + updating macro.positions.<bookId> (1s)');
}

// ── Solace (streaming UST prices) ───────────────────────────────────────
async function startSolace() {
  const { default: solace } = await import('solclientjs');
  const props = new solace.SolclientFactoryProperties();
  props.profile = solace.SolclientFactoryProfiles.version10_5;
  solace.SolclientFactory.init(props);
  const session = solace.SolclientFactory.createSession({
    url: SOLACE_URL,
    vpnName: SOLACE_VPN,
    userName: SOLACE_USER,
    password: SOLACE_PASS,
  });

  await new Promise((resolve, reject) => {
    session.on(solace.SessionEventCode.UP_NOTICE, resolve);
    session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e) => reject(new Error(e.infoStr)));
    session.connect();
  });

  every(300, () => {
    const data = ust(pick(USTS));
    const msg = solace.SolclientFactory.createMessage();
    msg.setDestination(solace.SolclientFactory.createTopicDestination(`ust/prices/${data.cusip}`));
    msg.setBinaryAttachment(JSON.stringify(data));
    msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    session.send(msg);
  });
  cleanups.push(() => session.disconnect());
  console.log('  ✓ Solace: ust/prices/<cusip> (300ms)');
}

// ── orchestration ───────────────────────────────────────────────────────
async function main() {
  console.log('Prism broker-lab feeder starting…');
  let nc;
  if (ENABLED.has('nats') || ENABLED.has('js')) {
    nc = await wsconnect({ servers: NATS_WS, name: 'prism-feeder' });
    cleanups.push(() => nc.drain());
    console.log(`Connected to NATS ${NATS_WS}`);
  }

  const results = await Promise.allSettled([
    ENABLED.has('nats') && nc ? startNatsCore(nc) : null,
    ENABLED.has('js') && nc ? startJetStream(nc) : null,
    ENABLED.has('solace') ? startSolace() : null,
  ]);
  for (const r of results) if (r.status === 'rejected') console.warn('  ✗ feed failed:', r.reason?.message ?? r.reason);

  console.log('\nPublishing… open http://localhost:4204 and pick a source. Ctrl-C to stop.');
}

async function shutdown() {
  console.log('\nStopping feeder…');
  for (const c of cleanups) {
    try {
      await c();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('Feeder failed to start:', err);
  process.exit(1);
});
