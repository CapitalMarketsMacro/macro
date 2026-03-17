import type OpenFin from '@openfin/core';
import type { App } from '@openfin/workspace';
import { AppManifestType, getCurrentSync } from '@openfin/workspace-platform';
import { Logger } from '@macro/logger';

const logger = Logger.getLogger('LaunchService');

/**
 * Recursively extract view component states from golden-layout content tree.
 */
function extractViews(content: any[], views: OpenFin.PlatformViewCreationOptions[]): void {
  for (const item of content) {
    if (item.type === 'component' && item.componentState) {
      views.push(item.componentState);
    } else if (item.content) {
      extractViews(item.content, views);
    }
  }
}

export async function launchApp(
  app: App,
): Promise<OpenFin.Platform | OpenFin.Identity | OpenFin.View | OpenFin.Application | undefined> {
  if (!app.manifest) {
    logger.error(`No manifest provided for type ${app.manifestType}`);
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
    case 'manifest': {
      const platform = getCurrentSync();
      const manifest = await platform.fetchManifest(app.manifest);
      // Extract views from the fetched manifest's snapshot
      const snapshot = (manifest as any)?.snapshot ?? (manifest as any)?.platform?.defaultWindowOptions;
      const views: OpenFin.PlatformViewCreationOptions[] = [];
      if (snapshot?.windows) {
        for (const win of snapshot.windows) {
          const layouts = win?.layout?.content;
          if (layouts) {
            extractViews(layouts, views);
          }
        }
      }
      // Create a named browser window with the app title and launch views into it
      const windowId = `${app.appId}-${Date.now()}`;
      await platform.Browser.createWindow({
        workspacePlatform: {
          pages: [
            {
              pageId: windowId,
              title: app.title,
              layout: {
                content: [
                  {
                    type: 'stack',
                    content: views.length > 0
                      ? views.map((v) => ({
                          type: 'component' as const,
                          componentName: 'view',
                          componentState: v,
                        }))
                      : [
                          {
                            type: 'component' as const,
                            componentName: 'view',
                            componentState: { url: app.manifest },
                          },
                        ],
                  },
                ],
              },
            },
          ],
        },
      } as any);
      break;
    }
    default: {
      result = await fin.Application.startFromManifest(app.manifest);
    }
  }

  return result;
}

