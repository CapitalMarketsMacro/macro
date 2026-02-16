import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCreateAngularAppPrompt } from './create-angular-app.js';
import { registerCreateReactAppPrompt } from './create-react-app.js';
import { registerAddGridComponentPrompt } from './add-grid-component.js';

export function registerPrompts(server: McpServer): void {
  registerCreateAngularAppPrompt(server);
  registerCreateReactAppPrompt(server);
  registerAddGridComponentPrompt(server);
}
