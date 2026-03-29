import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListLibraries } from './list-libraries.js';
import { registerGetLibraryApi } from './get-library-api.js';
import { registerGetCommands } from './get-commands.js';
import { registerAmpsExplore } from './amps-explore.js';

/**
 * macro-mcp-agent tools — remote/standalone deployment.
 *
 * Only includes tools that work without monorepo filesystem access:
 * - amps_explore: connect to AMPS, inspect topics, detect schema
 * - get_library_api: return API docs for @macro/* libraries
 * - list_libraries: list available libraries
 * - get_commands: list available npm scripts and NX commands
 *
 * Tools that create files (amps_create_mfe, import_figma_app, scaffold_*,
 * register_openfin_app) are only in macro-mcp (stdio, runs in monorepo).
 */
export function registerTools(server: McpServer): void {
  registerListLibraries(server);
  registerGetLibraryApi(server);
  registerGetCommands(server);
  registerAmpsExplore(server);
}
