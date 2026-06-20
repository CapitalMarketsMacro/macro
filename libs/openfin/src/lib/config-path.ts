/**
 * Resolve a public config file path based on how the platform was launched.
 * Mirrors SettingsService's env resolution: `?env=openshift` -> /openshift/, else /local/.
 * Used by the config-driven storefront, auth, and entitlements services.
 */
export function resolveEnvConfigPath(fileName: string): string {
  if (typeof window !== 'undefined') {
    const env = new URLSearchParams(window.location.search).get('env');
    if (env === 'openshift') return `/openshift/${fileName}`;
    if (env === 'local') return `/local/${fileName}`;
  }
  return `/local/${fileName}`;
}
