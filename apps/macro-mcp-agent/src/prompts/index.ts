import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCreateAngularAppPrompt } from './create-angular-app.js';
import { registerCreateReactAppPrompt } from './create-react-app.js';
import { registerAddGridComponentPrompt } from './add-grid-component.js';
import { registerAddFdc3ContextPrompt } from './add-fdc3-context.js';
import { registerAddThemeSupportPrompt } from './add-theme-support.js';
import { registerAddDataConnectivityPrompt } from './add-data-connectivity.js';

export function registerPrompts(server: McpServer): void {
  registerCreateAngularAppPrompt(server);
  registerCreateReactAppPrompt(server);
  registerAddGridComponentPrompt(server);
  registerAddFdc3ContextPrompt(server);
  registerAddThemeSupportPrompt(server);
  registerAddDataConnectivityPrompt(server);
}
