// Types
export * from './lib/types';
export type { ThemePalette, ThemeConfig } from '@macro/macro-design';
export { themeConfig } from '@macro/macro-design';

// Utilities
export { launchApp } from './lib/launch';
export { onOpenFinThemeChange } from './lib/theme-sync';
export { buildMacroGranularTheme } from './lib/granular-theme';
export { resolveEnvConfigPath } from './lib/config-path';

// Framework-agnostic base services (exported with 'Base' prefix to avoid conflicts)
export { SettingsService as BaseSettingsService } from './lib/settings.service';
export { ContextService as BaseContextService } from './lib/context.service';
export { ChannelService as BaseChannelService } from './lib/channel.service';
export { StoreService as BaseStoreService } from './lib/store.service';
export { FavoritesService as BaseFavoritesService } from './lib/favorites.service';
export { DockService as BaseDockService } from './lib/dock.service';
export { Dock3Service as BaseDock3Service } from './lib/dock3.service';
export { HomeService as BaseHomeService } from './lib/home.service';
export { NotificationsService as BaseNotificationsService } from './lib/notifications.service';
export type { NotificationLevel, LevelNotificationOptions, NotificationToastMode } from './lib/notifications.service';
export { WorkspaceStorageService as BaseWorkspaceStorageService } from './lib/workspace-storage.service';
export { WorkspaceOverrideService as BaseWorkspaceOverrideService } from './lib/workspace-override.service';
export { PlatformService as BasePlatformService } from './lib/platform.service';
export { WorkspaceService as BaseWorkspaceService } from './lib/workspace.service';
export { ThemeService as BaseThemeService } from './lib/theme.service';
export { ViewStateService as BaseViewStateService } from './lib/view-state.service';
export type { ViewStateData } from './lib/view-state.service';
export { ThemePresetService as BaseThemePresetService } from './lib/theme-preset.service';
export type { ThemePresetPalettes, ThemePresetInfo } from './lib/theme-preset.service';
export { SnapService as BaseSnapService } from './lib/snap.service';
export { AuthService as BaseAuthService } from './lib/auth.service';
export { EntitlementsService as BaseEntitlementsService } from './lib/entitlements.service';
export { LaunchService as BaseLaunchService } from './lib/launch.service';
export { StorefrontConfigService as BaseStorefrontConfigService } from './lib/storefront-config.service';
export { AppsService as BaseAppsService } from './lib/apps.service';
export { DockConfigService as BaseDockConfigService } from './lib/dock-config.service';
export { SnapConfigService as BaseSnapConfigService } from './lib/snap-config.service';
export { LocalStorageFavoritesStore } from './lib/favorites.service';
export type { FavoritesStore } from './lib/favorites.service';
export { hydrateViewTitles, setViewTitle, getViewTitles } from './lib/workspace-override.service';

// Unified Workspace Storage API (local localStorage mode + per-environment REST mode)
export type {
  WorkspaceStorageClient,
  StorageMode,
  StorageEnvironmentConfig,
  StorageSettings,
  ResolvedStorageEnvironment,
  LobDockApp,
  LobDockAppChild,
} from './lib/storage/storage-types';
export { WELL_KNOWN_PREFERENCES } from './lib/storage/storage-types';
export { LocalStorageWorkspaceStorageClient } from './lib/storage/local-storage-client';
export { RestWorkspaceStorageClient } from './lib/storage/rest-storage-client';
export type { RestWorkspaceStorageClientOptions } from './lib/storage/rest-storage-client';
export {
  resolveStorageEnvironment,
  listStorageEnvironments,
  getSavedStorageEnvironmentChoice,
  saveStorageEnvironmentChoice,
  STORAGE_ENV_QUERY_PARAM,
  STORAGE_ENV_CHOICE_KEY,
  LOCAL_STORAGE_ENVIRONMENT,
} from './lib/storage/storage-environment';
export {
  initWorkspaceStorage,
  getWorkspaceStorage,
  getActiveStorageEnvironment,
  whenWorkspaceStorageReady,
  resolveConfigUrl,
  ClientFavoritesStore,
} from './lib/storage/storage-context';

// Angular wrappers (for Angular applications) - these are the default exports
export * from './lib/angular';
