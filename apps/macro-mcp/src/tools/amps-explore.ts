import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

/**
 * Schema field detected from AMPS sample data.
 */
export interface AmpsSchemaField {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  nullable: boolean;
  sampleValues: any[];
  decimals: number; // max decimal places detected (for numbers)
}

export interface AmpsTopicInfo {
  name: string;
  keys: string[];        // e.g. ['/MarketId', '/Id']
  compositeKey: string;  // e.g. '/MarketId+/Id'
  messageType: string;
}

export interface AmpsTransportInfo {
  name: string;
  type: string;
  port: string;
  protocol: string;
}

export interface AmpsExploreResult {
  connected: boolean;
  ampsUrl: string;
  detectedWsUrl: string | null;  // auto-detected from config
  instanceName: string | null;
  topic?: string;
  messageCount: number;
  schema: AmpsSchemaField[];
  detectedKeys: string[];
  compositeKey: string | null;
  sampleData: Record<string, any>[];
  topicsFromConfig: AmpsTopicInfo[];
  transports: AmpsTransportInfo[];
  error?: string;
}

/**
 * Connect to AMPS, optionally SOW a topic, and return schema analysis.
 */
export async function exploreAmps(
  ampsUrl: string,
  topic?: string,
  filter?: string,
  configPath?: string,
  sampleSize = 10,
  timeout = 5000,
): Promise<AmpsExploreResult> {
  const result: AmpsExploreResult = {
    connected: false,
    ampsUrl,
    detectedWsUrl: null,
    instanceName: null,
    topic,
    messageCount: 0,
    schema: [],
    detectedKeys: [],
    compositeKey: null,
    sampleData: [],
    topicsFromConfig: [],
    transports: [],
  };

  // Parse config — supports local file path OR HTTP URL
  if (configPath) {
    try {
      let configContent: string;
      if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
        configContent = await fetchUrl(configPath, timeout);
      } else if (fs.existsSync(configPath)) {
        configContent = fs.readFileSync(configPath, 'utf8');
      } else {
        throw new Error(`Config not found: ${configPath}`);
      }

      const parsed = parseAmpsConfig(configContent);
      result.topicsFromConfig = parsed.topics;
      result.transports = parsed.transports;
      result.instanceName = parsed.instanceName;

      // Auto-detect WebSocket URL from config transports
      const wsTransport = parsed.transports.find(t => t.protocol === 'websocket');
      if (wsTransport) {
        // Derive hostname from configPath URL or ampsUrl
        let host = 'localhost';
        try {
          if (configPath.startsWith('http')) {
            host = new URL(configPath).hostname;
          } else if (ampsUrl) {
            host = new URL(ampsUrl).hostname;
          }
        } catch { /* keep localhost */ }
        result.detectedWsUrl = `ws://${host}:${wsTransport.port}/amps/json`;
      }

      // Find composite key for the requested topic
      if (topic) {
        const topicInfo = parsed.topics.find(t => t.name === topic);
        if (topicInfo) {
          result.compositeKey = topicInfo.compositeKey;
          result.detectedKeys = topicInfo.keys.map(k => k.replace(/^\//,''));
        }
      }
    } catch (err: any) {
      result.error = `Config parse error: ${err.message}`;
    }
  }

  // Resolve the AMPS WebSocket URL
  const connectUrl = ampsUrl || result.detectedWsUrl;
  if (connectUrl) {
    result.ampsUrl = connectUrl;
  }

  // Connect to AMPS (skip if no URL and no topic to query)
  let client: any;
  if (connectUrl && topic) {
    try {
      const { Client } = await import('amps');
      client = new Client('mcp-explorer');

      await Promise.race([
        client.connect(connectUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), timeout)),
      ]);
      result.connected = true;
    } catch (err: any) {
      result.error = `Connection failed to ${connectUrl}: ${err.message}`;
      return result;
    }
  } else if (!topic) {
    // Config-only mode — no connection needed
    return result;
  }

  // SOW query if topic provided
  if (topic && client) {
    try {
      const messages: Record<string, any>[] = [];
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          client.sow(
            (msg: any) => {
              try {
                const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                  messages.push(data);
                }
              } catch { /* skip non-JSON */ }
              // Check for group_end which signals SOW complete
              if (msg.header && msg.header.command && msg.header.command() === 'group_end') {
                resolve();
              }
            },
            topic,
            filter || undefined,
            { batchSize: sampleSize, timeout },
          ).then(() => {
            // SOW promise resolves after sending the command, not after all results
            // Give a brief window to collect results
            setTimeout(resolve, 1000);
          }).catch(reject);
        }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('SOW timeout')), timeout + 2000)),
      ]).catch(() => { /* timeout is ok, use what we have */ });

      result.sampleData = messages.slice(0, sampleSize);
      result.messageCount = messages.length;

      // Analyze schema
      if (messages.length > 0) {
        result.schema = analyzeSchema(messages);
        if (!result.compositeKey) {
          result.detectedKeys = detectKeys(messages, result.schema);
        } else {
          result.detectedKeys = result.compositeKey.replace(/^\//,'').split('+').map(k => k.replace(/^\//,''));
        }
      }
    } catch (err: any) {
      result.error = `SOW failed: ${err.message}`;
    }
  }

  // Disconnect
  try { await client.disconnect(); } catch { /* ignore */ }

  return result;
}

/**
 * Parse AMPS XML config to extract instance name, transports, topics, and composite keys.
 */
function parseAmpsConfig(content: string): {
  instanceName: string | null;
  topics: AmpsTopicInfo[];
  transports: AmpsTransportInfo[];
} {
  const topics: AmpsTopicInfo[] = [];
  const transports: AmpsTransportInfo[] = [];

  // Instance name
  const nameMatch = content.match(/<Name[^>]*>\s*([^<]+)\s*<\/Name>/i);
  const instanceName = nameMatch ? nameMatch[1].trim() : null;

  // Parse Transports
  const transportBlocks = content.match(/<Transport\b[^>]*>[\s\S]*?<\/Transport>/gi) || [];
  for (const block of transportBlocks) {
    const tName = block.match(/<Name[^>]*>\s*([^<]+)\s*<\/Name>/i);
    const tType = block.match(/<Type[^>]*>\s*([^<]+)\s*<\/Type>/i);
    const tPort = block.match(/<InetAddr[^>]*>\s*([^<]+)\s*<\/InetAddr>/i);
    const tProto = block.match(/<Protocol[^>]*>\s*([^<]+)\s*<\/Protocol>/i);
    if (tName) {
      transports.push({
        name: tName[1].trim(),
        type: tType?.[1]?.trim() || 'tcp',
        port: tPort?.[1]?.trim() || '',
        protocol: tProto?.[1]?.trim() || 'amps',
      });
    }
  }

  // Parse SOW topics (inside <SOW> block)
  const sowBlock = content.match(/<SOW\b[^>]*>([\s\S]*?)<\/SOW>/i);
  if (sowBlock) {
    const topicBlocks = sowBlock[1].match(/<Topic\b[^>]*>[\s\S]*?<\/Topic>/gi) || [];
    for (const block of topicBlocks) {
      const tName = block.match(/<Name[^>]*>\s*([^<]+)\s*<\/Name>/i);
      const tMsgType = block.match(/<MessageType[^>]*>\s*([^<]+)\s*<\/MessageType>/i);
      // Multiple <Key> elements = composite key
      const keyMatches = block.match(/<Key[^>]*>\s*([^<]+)\s*<\/Key>/gi) || [];
      const keys = keyMatches.map(k => {
        const m = k.match(/<Key[^>]*>\s*([^<]+)\s*<\/Key>/i);
        return m ? m[1].trim() : '';
      }).filter(Boolean);

      if (tName) {
        topics.push({
          name: tName[1].trim(),
          keys,
          compositeKey: keys.join('+'),
          messageType: tMsgType?.[1]?.trim() || 'json',
        });
      }
    }
  }

  return { instanceName, topics, transports };
}

/**
 * Fetch content from an HTTP/HTTPS URL.
 */
function fetchUrl(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

/**
 * Analyze message schema from sample data.
 */
function analyzeSchema(messages: Record<string, any>[]): AmpsSchemaField[] {
  const fieldMap = new Map<string, { values: any[]; types: Set<string>; nullCount: number }>();

  for (const msg of messages) {
    for (const [key, value] of Object.entries(msg)) {
      if (!fieldMap.has(key)) {
        fieldMap.set(key, { values: [], types: new Set(), nullCount: 0 });
      }
      const entry = fieldMap.get(key)!;
      if (value == null) {
        entry.nullCount++;
      } else {
        entry.values.push(value);
        entry.types.add(typeof value);
      }
    }
  }

  return Array.from(fieldMap.entries()).map(([field, entry]) => {
    let type: AmpsSchemaField['type'] = 'string';
    if (entry.types.size === 1) {
      const t = entry.types.values().next().value;
      if (t === 'number') type = 'number';
      else if (t === 'boolean') type = 'boolean';
      else if (t === 'object') type = Array.isArray(entry.values[0]) ? 'array' : 'object';
    } else if (entry.types.has('number') && entry.values.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
      type = 'number';
    }

    let decimals = 0;
    if (type === 'number') {
      for (const v of entry.values) {
        const str = String(v);
        const dot = str.indexOf('.');
        if (dot >= 0) decimals = Math.max(decimals, str.length - dot - 1);
      }
    }

    const uniqueValues = [...new Set(entry.values.slice(0, 5))];

    return {
      field,
      type,
      nullable: entry.nullCount > 0,
      sampleValues: uniqueValues.slice(0, 3),
      decimals,
    };
  });
}

/**
 * Detect likely key fields from data patterns.
 */
function detectKeys(messages: Record<string, any>[], schema: AmpsSchemaField[]): string[] {
  const candidates: string[] = [];
  const commonKeyNames = new Set(['id', 'key', '_id', 'symbol', 'cusip', 'isin', 'ticker', 'securityId', 'tradeId', 'orderId']);

  for (const field of schema) {
    if (field.type !== 'string' && field.type !== 'number') continue;

    // Check if field name is a common key pattern
    if (commonKeyNames.has(field.field) || commonKeyNames.has(field.field.toLowerCase())) {
      candidates.push(field.field);
      continue;
    }

    // Check if values are unique across all messages
    const values = messages.map(m => m[field.field]).filter(v => v != null);
    const uniqueValues = new Set(values);
    if (values.length > 1 && uniqueValues.size === values.length) {
      candidates.push(field.field);
    }
  }

  return candidates;
}

// ── MCP Registration ──

export function registerAmpsExplore(server: McpServer): void {
  server.tool(
    'amps_explore',
    'Connect to a live AMPS instance, inspect topics, SOW sample data, and analyze message schema. Returns field names, types, sample values, and detected composite keys. Use this to understand AMPS data before creating an MFE.',
    {
      ampsUrl: z.string().optional().describe('AMPS WebSocket URL (e.g., "ws://amps-server:9100/amps/json"). If omitted, auto-detected from config.'),
      topic: z.string().optional().describe('Topic to query via SOW. If omitted, only tests connection.'),
      filter: z.string().optional().describe('AMPS filter expression (e.g., "/symbol=\'EURUSD\'")'),
      configPath: z.string().optional().describe('Path or URL to AMPS XML config (e.g., "http://host:8085/amps/instance/config.xml" or local file path)'),
      sampleSize: z.number().optional().describe('Max messages to fetch from SOW (default: 10)'),
      timeout: z.number().optional().describe('Connection/SOW timeout in ms (default: 5000)'),
    },
    async ({ ampsUrl, topic, filter, configPath, sampleSize, timeout }) => {
      const effectiveUrl = ampsUrl || ''; // will be resolved from config if empty
      const result = await exploreAmps(effectiveUrl, topic, filter, configPath, sampleSize ?? 10, timeout ?? 5000);
      // If no ampsUrl was provided but we detected one from config, use it
      if (!ampsUrl && result.detectedWsUrl) {
        result.ampsUrl = result.detectedWsUrl;
      }

      let text = `## AMPS Explore: ${ampsUrl}\n\n`;
      text += `Connected: ${result.connected}\n`;
      if (result.instanceName) text += `Instance: ${result.instanceName}\n`;
      if (result.detectedWsUrl) text += `WebSocket URL: ${result.detectedWsUrl}\n`;

      if (result.error) text += `\nError: ${result.error}\n`;

      if (result.transports.length > 0) {
        text += `\nTransports:\n`;
        result.transports.forEach(t => { text += `  - ${t.name}: ${t.protocol} on port ${t.port}\n`; });
      }

      if (result.topicsFromConfig.length > 0) {
        text += `\nSOW Topics (${result.topicsFromConfig.length}):\n`;
        result.topicsFromConfig.forEach(t => {
          text += `  - ${t.name} [key: ${t.compositeKey || 'none'}] (${t.messageType})\n`;
        });
      }

      if (result.topic) {
        text += `\nTopic: ${result.topic}\n`;
        text += `Messages: ${result.messageCount}\n`;

        if (result.compositeKey) text += `Composite Key: ${result.compositeKey}\n`;
        if (result.detectedKeys.length) text += `Detected Keys: ${result.detectedKeys.join(', ')}\n`;

        if (result.schema.length > 0) {
          text += `\nSchema (${result.schema.length} fields):\n`;
          text += `| Field | Type | Decimals | Sample Values |\n|-------|------|----------|---------------|\n`;
          for (const f of result.schema) {
            text += `| ${f.field} | ${f.type} | ${f.decimals} | ${f.sampleValues.map(String).join(', ')} |\n`;
          }
        }

        if (result.sampleData.length > 0) {
          text += `\nSample Data (first ${Math.min(3, result.sampleData.length)}):\n`;
          text += '```json\n' + JSON.stringify(result.sampleData.slice(0, 3), null, 2) + '\n```\n';
        }
      }

      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
