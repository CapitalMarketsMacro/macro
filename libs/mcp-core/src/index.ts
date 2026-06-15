/**
 * @macro/mcp-core — the shared MCP surface (tools, resources, prompts) for the
 * Macro Desktop MCP servers.
 *
 * Two thin entrypoints consume this single source so they can never drift:
 *   - apps/macro-mcp       → stdio transport (registered in .mcp.json)
 *   - apps/macro-mcp-agent → HTTP / SSE transport (remote deployment)
 *
 * Both call registerTools/registerResources/registerPrompts against their McpServer.
 */
export { registerTools } from './lib/tools/index.js';
export { registerResources } from './lib/resources/index.js';
export { registerPrompts } from './lib/prompts/index.js';
