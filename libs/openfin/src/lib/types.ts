import type OpenFin from '@openfin/core';
import type { App } from '@openfin/workspace';

export interface Dock3FavoriteEntry {
  type: 'item';
  id: string;
  icon: string;
  label: string;
  appId?: string;
}

export interface Dock3ContentFolder {
  type: 'folder';
  id: string;
  label: string;
  children: Dock3ContentEntry[];
}

export interface Dock3ContentItem {
  type: 'item';
  id: string;
  icon: string;
  label: string;
  appId?: string;
}

export type Dock3ContentEntry = Dock3ContentFolder | Dock3ContentItem;

export interface Dock3Settings {
  favorites?: Dock3FavoriteEntry[];
  contentMenu?: Dock3ContentEntry[];
}

export interface SnapProviderSettings {
  enabled?: boolean;
  serverOptions?: {
    showDebug?: boolean;
    disableUserUnstick?: boolean;
    keyToStick?: boolean | 'ctrl' | 'shift';
    disableGPUAcceleratedDragging?: boolean;
    disableBlurDropPreview?: boolean;
    autoHideClientTaskbarIcons?: boolean;
    theme?: 'snap-original' | 'snap-light1' | 'snap-dark1';
  };
}

export interface CustomSettings {
  apps?: App[];
  dock3?: Dock3Settings;
  snapProvider?: SnapProviderSettings;
}

export interface PlatformSettings {
  id: string;
  title: string;
  icon: string;
}

export type ManifestWithCustomSettings = OpenFin.Manifest & { customSettings?: CustomSettings };

export interface SettingsResponse {
  platformSettings: PlatformSettings;
  /** @deprecated apps/dock3/snapProvider now live in their own config files/services. */
  customSettings?: CustomSettings;
}

/** Shape of apps.json — the app registry, loaded by AppsService. */
export interface AppsConfig {
  apps: App[];
}

// --- Enterprise storefront: config-driven navigation / landing / footer ---

/** An OpenFin App plus our enterprise metadata. `category` = business area (FX, Rates, …). */
export type MacroApp = App & { category?: string };

/** One navigation item = a business area rendered as an AppGrid (apps filtered by `category`). */
export interface StorefrontNavItemConfig {
  id: string;
  title: string;
  /** Business-area key matched against each app's `category`; `'*'` = all apps. */
  category: string;
}

export interface StorefrontNavSectionConfig {
  id: string;
  title: string;
  items: StorefrontNavItemConfig[];
}

export interface StorefrontNavigationConfig {
  /** Title for the auto-managed, dynamic Favorites section. */
  favoritesTitle?: string;
  sections: StorefrontNavSectionConfig[];
}

export interface StorefrontImageConfig {
  src: string;
  size?: string;
}

/** A landing-page row sourced either by explicit appIds or a category (`'*'` = all). */
export interface StorefrontRowConfig {
  title: string;
  appIds?: string[];
  category?: string;
}

export interface StorefrontHeroConfig {
  title: string;
  description: string;
  image?: StorefrontImageConfig;
}

export interface StorefrontLandingConfig {
  hero?: StorefrontHeroConfig;
  topRow?: StorefrontRowConfig;
  middleRow?: StorefrontRowConfig;
  bottomRow?: StorefrontRowConfig;
}

export interface StorefrontLinkConfig {
  title: string;
  url: string;
}

export interface StorefrontFooterConfig {
  logo?: StorefrontImageConfig;
  text?: string;
  links?: StorefrontLinkConfig[];
}

export interface StorefrontConfig {
  navigation: StorefrontNavigationConfig;
  landingPage?: StorefrontLandingConfig;
  footer?: StorefrontFooterConfig;
  cardClickBehavior?: 'show-app-details' | 'perform-primary-button-action';
}

// --- Enterprise auth / entitlements ---

/** Authenticated user identity (mock/config-driven by default; swap for a real IdP). */
export interface User {
  id: string;
  name: string;
  groups?: string[];
  /** Entitlement keys the user holds; matched against each app's required entitlements. */
  entitlements: string[];
}

export interface EntitlementsConfig {
  currentUser: User;
  /** appId -> required entitlements (any-of). Missing/empty entry = launchable by everyone. */
  apps: Record<string, string[]>;
}

