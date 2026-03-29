import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerScaffoldAngularApp } from './scaffold-angular-app.js';
import { registerScaffoldReactApp } from './scaffold-react-app.js';
import { registerListLibraries } from './list-libraries.js';
import { registerGetLibraryApi } from './get-library-api.js';
import { registerGetCommands } from './get-commands.js';
import { registerScaffoldLibrary } from './scaffold-library.js';
import { registerRegisterOpenfinApp } from './register-openfin-app.js';
import { registerImportFigmaApp } from './import-figma-app.js';
import { registerAmpsExplore } from './amps-explore.js';
import { registerAmpsCreateMfe } from './amps-create-mfe.js';

export function registerTools(server: McpServer): void {
  registerScaffoldAngularApp(server);
  registerScaffoldReactApp(server);
  registerListLibraries(server);
  registerGetLibraryApi(server);
  registerGetCommands(server);
  registerScaffoldLibrary(server);
  registerRegisterOpenfinApp(server);
  registerImportFigmaApp(server);
  registerAmpsExplore(server);
  registerAmpsCreateMfe(server);
}
