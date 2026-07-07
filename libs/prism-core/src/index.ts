/**
 * @macro/prism-core — framework-free core of the Prism blotter (model, capital-markets column
 * inference, the transport→grid feed controller, and the data-source store). Consumed by both
 * `apps/prism` (Angular) and `apps/prism-react` via thin per-framework adapters.
 */
export * from './lib/blotter-source';
export * from './lib/column-inference';
export * from './lib/rollup';
export * from './lib/blotter-feed';
export * from './lib/data-source-store';
export * from './lib/ws-table-client';
export * from './lib/rest-table-client';
