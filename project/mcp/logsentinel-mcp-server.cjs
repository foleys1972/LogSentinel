#!/usr/bin/env node
/**
 * LogSentinel MCP Server (stdio)
 * Exposes LogSentinel monitoring data and AI tools to MCP clients (Cursor, Claude Desktop, etc.)
 *
 * Env:
 *   LOGSENTINEL_URL          - e.g. http://localhost:3000
 *   LOGSENTINEL_MCP_API_KEY  - must match server LOGSENTINEL_MCP_API_KEY
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const BASE_URL = (process.env.LOGSENTINEL_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API_KEY = process.env.LOGSENTINEL_MCP_API_KEY || '';

async function apiRequest(path, { method = 'GET', body } = {}) {
  if (!API_KEY) {
    throw new Error('LOGSENTINEL_MCP_API_KEY is not set for the MCP server process');
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

const TOOLS = [
  {
    name: 'logsentinel_status',
    description:
      'Check LogSentinel server health, log buffer size, and which modules (ML, LLM, predictive) are active.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'logsentinel_get_logs',
    description:
      'Fetch recent monitored log entries from LogSentinel. Filter by site, severity level, text search, or time range.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries (1-500, default 50)' },
        siteId: { type: 'string', description: 'Site id or site name' },
        level: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Log severity level'
        },
        search: { type: 'string', description: 'Case-insensitive substring in message/source/errorCode' },
        since: { type: 'string', description: 'ISO datetime — logs on or after this time' },
        until: { type: 'string', description: 'ISO datetime — logs on or before this time' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'logsentinel_search_logs',
    description: 'Search log messages with a JavaScript regular expression (case-insensitive).',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to match against log messages' },
        siteId: { type: 'string' },
        level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
        limit: { type: 'number', description: 'Max matches (1-200, default 50)' }
      },
      required: ['pattern'],
      additionalProperties: false
    }
  },
  {
    name: 'logsentinel_get_baselines',
    description:
      'Get ML baseline data: per-site log frequency, error rates, and known error/message patterns learned from monitoring.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'logsentinel_service_improvement',
    description:
      'Ask LogSentinel configured LLM for service improvement suggestions based on recent logs and optional context (sites, anomalies, user notes).',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Optional focus or question for the analysis' },
        sites: { type: 'array', items: { type: 'object' }, description: 'Optional site summaries' },
        anomalies: { type: 'array', items: { type: 'object' }, description: 'Optional anomaly list' },
        recentLogs: { type: 'array', items: { type: 'object' }, description: 'Override default recent logs' }
      },
      additionalProperties: true
    }
  },
  {
    name: 'logsentinel_suggest_baselines',
    description:
      'Use LLM to suggest new ML baseline patterns from recent logs. Set apply=true to persist accepted patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        apply: { type: 'boolean', description: 'If true, apply suggested baseline updates on the server' },
        context: { type: 'object', description: 'Optional extra context for the LLM' }
      },
      additionalProperties: false
    }
  }
];

function jsonContent(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

async function handleTool(name, args) {
  switch (name) {
    case 'logsentinel_status':
      return jsonContent(await apiRequest('/api/mcp/status'));

    case 'logsentinel_get_logs': {
      const params = new URLSearchParams();
      if (args?.limit != null) params.set('limit', String(args.limit));
      if (args?.siteId) params.set('siteId', args.siteId);
      if (args?.level) params.set('level', args.level);
      if (args?.search) params.set('search', args.search);
      if (args?.since) params.set('since', args.since);
      if (args?.until) params.set('until', args.until);
      const q = params.toString();
      return jsonContent(await apiRequest(`/api/mcp/logs${q ? `?${q}` : ''}`));
    }

    case 'logsentinel_search_logs':
      return jsonContent(
        await apiRequest('/api/mcp/search-logs', {
          method: 'POST',
          body: {
            pattern: args.pattern,
            siteId: args.siteId,
            level: args.level,
            limit: args.limit
          }
        })
      );

    case 'logsentinel_get_baselines':
      return jsonContent(await apiRequest('/api/mcp/baselines'));

    case 'logsentinel_service_improvement':
      return jsonContent(
        await apiRequest('/api/mcp/service-improvement', {
          method: 'POST',
          body: args || {}
        })
      );

    case 'logsentinel_suggest_baselines':
      return jsonContent(
        await apiRequest('/api/mcp/update-baselines', {
          method: 'POST',
          body: { apply: !!args?.apply, context: args?.context }
        })
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function main() {
  const server = new Server(
    { name: 'logsentinel', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleTool(request.params.name, request.params.arguments || {});
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[LogSentinel MCP]', err);
  process.exit(1);
});
