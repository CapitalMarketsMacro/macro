/**
 * Subscribe to OpenFin workspace theme-change broadcasts.
 *
 * This is a deliberately dependency-free mirror of `@macro/openfin`'s
 * `onOpenFinThemeChange` so that `@macro/macro-design` stays framework- and
 * platform-agnostic (no dependency on `@macro/openfin`). It reads the OpenFin
 * runtime off `globalThis.fin` and no-ops cleanly in a plain browser.
 *
 * The platform broadcasts `{ isDark: boolean }` on this topic whenever the
 * selected color scheme changes (see `WorkspaceOverrideService.setSelectedScheme`).
 */
const THEME_CHANGED_TOPIC = 'workspace:theme-changed';

interface OpenFinIAB {
  subscribe(source: { uuid: string }, topic: string, handler: (payload: { isDark: boolean }) => void): void;
  unsubscribe(source: { uuid: string }, topic: string, handler: (payload: { isDark: boolean }) => void): void;
}

function getIab(): OpenFinIAB | undefined {
  return (globalThis as unknown as { fin?: { InterApplicationBus?: OpenFinIAB } }).fin?.InterApplicationBus;
}

/**
 * Invoke `cb(isDark)` whenever the OpenFin platform theme changes.
 * Returns a cleanup function. No-ops (and returns a no-op cleanup) when not
 * running inside the OpenFin runtime.
 */
export function onOpenFinThemeChange(cb: (isDark: boolean) => void): () => void {
  const iab = getIab();
  if (!iab) {
    return () => {
      /* not running inside OpenFin */
    };
  }

  const handler = (payload: { isDark: boolean }) => cb(payload.isDark);
  iab.subscribe({ uuid: '*' }, THEME_CHANGED_TOPIC, handler);

  return () => {
    try {
      iab.unsubscribe({ uuid: '*' }, THEME_CHANGED_TOPIC, handler);
    } catch {
      /* ignore unsubscribe errors during teardown */
    }
  };
}
