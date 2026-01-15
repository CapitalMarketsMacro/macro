import type OpenFin from '@openfin/core';

declare global {
  // OpenFin injects a global `fin` object at runtime.
  // The `@openfin/core` package doesn't expose this global in its main `types` entry,
  // so we declare it here for TypeScript consumers of this library.
  // eslint-disable-next-line no-var
  var fin: OpenFin.Fin<'window' | 'view'>;
}

export {};

