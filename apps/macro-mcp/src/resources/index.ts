import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerArchitecture } from './architecture.js';
import { registerAngularTemplate } from './angular-template.js';
import { registerReactTemplate } from './react-template.js';
import { registerTheming } from './theming.js';
import { registerDataConnectivity } from './data-connectivity.js';
import { registerOpenfin } from './openfin.js';
import { registerLibraries } from './libraries.js';
import { registerMarketDataServer } from './market-data-server.js';
import { registerTesting } from './testing.js';
import { registerTechStack } from './tech-stack.js';
import { registerLobGuide } from './lob-guide.js';

export function registerResources(server: McpServer): void {
  registerArchitecture(server);
  registerAngularTemplate(server);
  registerReactTemplate(server);
  registerTheming(server);
  registerDataConnectivity(server);
  registerOpenfin(server);
  registerLibraries(server);
  registerMarketDataServer(server);
  registerTesting(server);
  registerTechStack(server);
  registerLobGuide(server);
}
