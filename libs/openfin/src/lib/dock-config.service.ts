import { Logger } from '@macro/logger';
import type { Dock3Settings } from './types';

const logger = Logger.getLogger('DockConfigService');

const EMPTY_CONFIG: Dock3Settings = { favorites: [], contentMenu: [] };

/**
 * Loads the dock configuration (`dock-config.json`): the Dock3 favorites and
 * content-menu definition. Split out of SettingsService into its own config/service
 * (consumed by Dock3Service), mirroring StorefrontConfigService.
 */
export class DockConfigService {
  private config: Dock3Settings | null = null;
  private loading: Promise<Dock3Settings> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
  ) {}

  async getDockConfig(): Promise<Dock3Settings> {
    if (this.config) return this.config;
    if (!this.loading) {
      this.loading = this.httpClient
        .get<Dock3Settings>(this.resolvePath())
        .then((cfg) => (this.config = cfg ?? EMPTY_CONFIG))
        .catch((error) => {
          logger.error('Failed to load dock-config.json; using empty config', error);
          return (this.config = EMPTY_CONFIG);
        });
    }
    return this.loading;
  }
}
