/**
 * Resolve the Windows taskbar icon URL for a platform window.
 *
 * Windows taskbar icons must be a raster format (.ico / .png) — an SVG is
 * ignored by the OS and the OpenFin runtime falls back to the stock OpenFin
 * icon. The app ships a multi-resolution `favicon.ico` at the web root, so we
 * resolve `/favicon.ico` against the in-app icon's origin regardless of what
 * the in-app icon points to (e.g. a themed `.svg` under a subpath such as
 * `/MacroThemeCondensed/assets/favicon.svg`).
 *
 * @param icon Absolute URL of the in-app window icon (e.g. `platformSettings.icon`).
 * @returns Absolute URL of the root `favicon.ico` on the same origin.
 */
export function toTaskbarIcon(icon: string): string {
  try {
    return new URL('/favicon.ico', icon).href;
  } catch {
    // Relative/invalid icon (no parseable origin) — best effort: swap the
    // last path segment for favicon.ico so we never feed an SVG to the taskbar.
    return icon.replace(/[^/]*$/, 'favicon.ico');
  }
}
