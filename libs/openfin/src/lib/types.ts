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
  customSettings: CustomSettings;
}

