import type OpenFin from '@openfin/core';
import type { App } from '@openfin/workspace';
import { AppManifestType, getCurrentSync } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('LaunchService');

/**
 * Launch a workspace App from the Store, Home or Dock.
 *
 * The behaviour is driven entirely by `app.manifestType` so every entry point
 * (Store card, Home search result, Dock button/Dock3 entry) gets identical,
 * type-correct launching:
 *
 * - `view`     → a single MFE view created inside the current platform window.
 * - `snapshot` → a saved layout applied into the current platform.
 * - `manifest` → a full OpenFin **application/platform** booted from its own
 *                manifest URL (its own runtime, provider and windows). This is
 *                how nested platforms such as the Rates E-Trading Desktop are
 *                launched, rather than being collapsed into a single view.
 * - `external` → a native executable launched as an external process.
 */
export async function launchApp(
  app: App,
): Promise<OpenFin.Platform | OpenFin.Identity | OpenFin.View | OpenFin.Application | undefined> {
  if (!app.manifest) {
    logger.error(`No manifest provided for type ${app.manifestType}`);
    return;
  }

  logger.info('Launching app', { appId: app.appId, manifestType: app.manifestType });

  let result: OpenFin.Platform | OpenFin.Identity | OpenFin.View | OpenFin.Application | undefined;

  switch (app.manifestType) {
    case AppManifestType.Snapshot: {
      const platform = getCurrentSync();
      result = await platform.applySnapshot(app.manifest);
      break;
    }
    case AppManifestType.View: {
      const platform = getCurrentSync();
      result = await platform.createView({ manifestUrl: app.manifest });
      break;
    }
    case AppManifestType.External: {
      result = await fin.System.launchExternalProcess({ path: app.manifest, uuid: app.appId });
      break;
    }
    case AppManifestType.Manifest: {
      // Boot the whole OpenFin app/platform from its manifest. startFromManifest
      // inspects the manifest: a `platform` block starts a separate Workspace
      // Platform (own provider + windows); otherwise it starts a classic app.
      result = await fin.Application.startFromManifest(app.manifest);
      break;
    }
    default: {
      result = await fin.Application.startFromManifest(app.manifest);
    }
  }

  return result;
}
