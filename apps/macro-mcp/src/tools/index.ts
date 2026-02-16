import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScaffoldAngularApp } from './scaffold-angular-app.js';
import { registerScaffoldReactApp } from './scaffold-react-app.js';
import { registerListLibraries } from './list-libraries.js';
import { registerGetLibraryApi } from './get-library-api.js';

export function registerTools(server: McpServer): void {
  registerScaffoldAngularApp(server);
  registerScaffoldReactApp(server);
  registerListLibraries(server);
  registerGetLibraryApi(server);
}
