/**
 * IAB topic for theme changes — duplicated here to avoid importing
 * workspace-override.service (which pulls in @openfin/workspace-platform
 * and crashes outside the OpenFin runtime).
 */
const THEME_CHANGED_TOPIC = 'workspace:theme-changed';

/**
 * Subscribe to OpenFin platform theme changes broadcast via InterApplicationBus.
 * Works in any view (Angular, React, or plain JS) running inside OpenFin.
 *
 * @param cb Called with `true` for dark, `false` for light whenever the platform theme changes.
 * @returns A cleanup function that removes the listener.
 */
export function onOpenFinThemeChange(cb: (isDark: boolean) => void): () => void {
  const iab = (globalThis as any).fin?.InterApplicationBus;
  if (!iab) return () => {};

  const handler = (payload: { isDark: boolean }) => cb(payload.isDark);

  iab
    .subscribe({ uuid: '*' }, THEME_CHANGED_TOPIC, handler)
    .catch(() => { /* not in OpenFin */ });

  return () => {
    iab
      .unsubscribe({ uuid: '*' }, THEME_CHANGED_TOPIC, handler)
      .catch(() => {});
  };
}
