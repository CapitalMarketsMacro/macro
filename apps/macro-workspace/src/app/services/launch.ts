import type OpenFin from '@openfin/core';
import type { App } from '@openfin/workspace';
import { AppManifestType, getCurrentSync } from '@openfin/workspace-platform';

export async function launchApp(
  app: App,
): Promise<OpenFin.Platform | OpenFin.Identity | OpenFin.View | OpenFin.Application | undefined> {
  if (!app.manifest) {
    console.error(`No manifest provided for type ${app.manifestType}`);
    return;
  }

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
    default: {
      result = await fin.Application.startFromManifest(app.manifest);
    }
  }

  return result;
}
