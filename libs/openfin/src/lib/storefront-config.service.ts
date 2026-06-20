import { Logger } from '@macro/logger';
import type { StorefrontConfig } from './types';

const logger = Logger.getLogger('StorefrontConfigService');

const DEFAULT_CARD_CLICK_BEHAVIOR = 'perform-primary-button-action' as const;

/** Empty fallback so the storefront still renders if the config file is missing. */
const EMPTY_CONFIG: StorefrontConfig = { navigation: { sections: [] } };

/**
 * Loads the config-driven storefront definition (`storefront-config.json`):
 * left-nav business-area categories, landing page, footer, and card-click behaviour.
 * Follows the SettingsService pattern (injected httpClient + env path resolution);
 * caches so the file is fetched once.
 */
export class StorefrontConfigService {
  private config: StorefrontConfig | null = null;
  private loading: Promise<StorefrontConfig> | null = null;

  constructor(
    private readonly httpClient: { get: <T>(url: string) => Promise<T> },
    private readonly resolvePath: () => string,
  ) {}

  async load(): Promise<StorefrontConfig> {
    if (this.config) return this.config;
    if (!this.loading) {
      this.loading = this.httpClient
        .get<StorefrontConfig>(this.resolvePath())
        .then((cfg) => (this.config = cfg))
        .catch((error) => {
          logger.error('Failed to load storefront-config.json; using empty config', error);
          return (this.config = EMPTY_CONFIG);
        });
    }
    return this.loading;
  }

  async getNavigationConfig() {
    return (await this.load()).navigation;
  }

  async getLandingPageConfig() {
    return (await this.load()).landingPage;
  }

  async getFooterConfig() {
    return (await this.load()).footer;
  }

  async getCardClickBehavior() {
    return (await this.load()).cardClickBehavior ?? DEFAULT_CARD_CLICK_BEHAVIOR;
  }
}
