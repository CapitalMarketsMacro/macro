import { Logger } from '@macro/logger';
import type { SnapProviderSettings } from './types';

const logger = Logger.getLogger('SnapConfigService');

/** Default: enabled, SDK defaults for server options. */
const DEFAULT_CONFIG: SnapProviderSettings = { enabled: true };

/**
 * Loads the Snap provider configuration (`snap-config.json`). Split out of
 * SettingsService into its own config/service (consumed by SnapService),
 * mirroring StorefrontConfigService.
 */
export class SnapConfigService {
  private config: SnapProviderSettings | null = null;
  private loading: Promise<SnapProviderSettings> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
  ) {}

  async getSnapConfig(): Promise<SnapProviderSettings> {
    if (this.config) return this.config;
    if (!this.loading) {
      this.loading = this.httpClient
        .get<SnapProviderSettings>(this.resolvePath())
        .then((cfg) => (this.config = cfg ?? DEFAULT_CONFIG))
        .catch((error) => {
          logger.error('Failed to load snap-config.json; using defaults', error);
          return (this.config = DEFAULT_CONFIG);
        });
    }
    return this.loading;
  }
}
