// Types
export * from './lib/types';
export type { ThemePalette, ThemeConfig } from '@macro/macro-design';
export { themeConfig } from '@macro/macro-design';

// Utilities
export { launchApp } from './lib/launch';

// Framework-agnostic base services (exported with 'Base' prefix to avoid conflicts)
export { SettingsService as BaseSettingsService } from './lib/settings.service';
export { ContextService as BaseContextService } from './lib/context.service';
export { ChannelService as BaseChannelService } from './lib/channel.service';
export { StoreService as BaseStoreService } from './lib/store.service';
export { DockService as BaseDockService } from './lib/dock.service';
export { HomeService as BaseHomeService } from './lib/home.service';
export { NotificationsService as BaseNotificationsService } from './lib/notifications.service';
export { WorkspaceOverrideService as BaseWorkspaceOverrideService } from './lib/workspace-override.service';
export { PlatformService as BasePlatformService } from './lib/platform.service';
export { WorkspaceService as BaseWorkspaceService } from './lib/workspace.service';
export { ThemeService as BaseThemeService } from './lib/theme.service';

// Angular wrappers (for Angular applications) - these are the default exports
export * from './lib/angular';
