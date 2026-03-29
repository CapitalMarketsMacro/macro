import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';
import { registerPrompts } from './prompts/index.js';

const PORT = parseInt(process.env['MCP_PORT'] || '3100', 10);
const HOST = process.env['MCP_HOST'] || '0.0.0.0';

function createServer(): McpServer {
  const server = new McpServer(
    { name: 'macro-mcp-agent', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {}, prompts: {} } },
  );
  registerResources(server);
  registerTools(server);
  registerPrompts(server);
  return server;
}

async function main() {
  const app = express();
  app.use(express.json());

  app.use((req: any, _res: any, next: any) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });

  app.use((_req: any, res: any, next: any) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
    res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  app.get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', name: 'macro-mcp-agent', version: '1.0.0', uptime: process.uptime() });
  });

  // ── Streamable HTTP (stateless — each request pair gets its own server) ──

  const server = createServer();

  app.all('/mcp', async (req: any, res: any) => {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined } as any);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      // If server is already connected, create a fresh one
      if (err.message?.includes('Already connected')) {
        const freshServer = createServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined } as any);
        await freshServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } else {
        console.error('[macro-mcp-agent] /mcp error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
      }
    }
  });

  // ── Legacy SSE ──

  const sseSessions: Record<string, SSEServerTransport> = {};

  app.get('/sse', async (_req: any, res: any) => {
    const transport = new SSEServerTransport('/messages', res as any);
    sseSessions[transport.sessionId] = transport;
    res.on('close', () => { delete sseSessions[transport.sessionId]; });
    const sseServer = createServer();
    await sseServer.connect(transport);
  });

  app.post('/messages', async (req: any, res: any) => {
    const sid = req.query.sessionId as string;
    const transport = sseSessions[sid];
    if (!transport) { res.status(400).json({ error: 'Invalid session' }); return; }
    await transport.handlePostMessage(req as any, res as any, req.body);
  });

  // ── Start ──

  app.listen(PORT, HOST, () => {
    console.log(`macro-mcp-agent on http://${HOST}:${PORT}
  Config: { "url": "http://<host>:${PORT}/mcp" }`);
  });

  process.on('SIGINT', () => process.exit(0));
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
