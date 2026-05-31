/**
 * MCP integration settings — persisted in data/mcp-config.json
 * Env LOGSENTINEL_MCP_API_KEY still works as fallback when enabled.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, 'data', 'mcp-config.json');

function ensureDataDir() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadConfig() {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        enabled: data.enabled ?? false,
        apiKey: data.apiKey || '',
        publicUrl: data.publicUrl || ''
      };
    }
  } catch (e) {
    console.warn('[MCP] Could not load config:', e.message);
  }
  return { enabled: false, apiKey: '', publicUrl: '' };
}

function saveConfig(config) {
  ensureDataDir();
  const toSave = {
    enabled: !!config.enabled,
    apiKey: config.apiKey || undefined,
    publicUrl: config.publicUrl || undefined
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf8');
}

function getEnvApiKey() {
  return process.env.LOGSENTINEL_MCP_API_KEY || '';
}

function getEffectiveApiKey() {
  const cfg = loadConfig();
  if (cfg.apiKey) return cfg.apiKey;
  return getEnvApiKey();
}

function isMcpApiEnabled() {
  if (getEnvApiKey()) return true;
  const cfg = loadConfig();
  return cfg.enabled && !!cfg.apiKey;
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function getPublicUrl(req) {
  const cfg = loadConfig();
  if (cfg.publicUrl?.trim()) return cfg.publicUrl.trim().replace(/\/+$/, '');
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

function getConfigSafe(req) {
  const cfg = loadConfig();
  const envKey = getEnvApiKey();
  const hasApiKey = !!(cfg.apiKey || envKey);
  const enabledEffective = isMcpApiEnabled() && hasApiKey;
  return {
    enabled: cfg.enabled,
    hasApiKey,
    hasEnvApiKey: !!envKey,
    enabledEffective,
    publicUrl: getPublicUrl(req),
    mcpServerPath: path.join(__dirname, 'mcp', 'logsentinel-mcp-server.cjs'),
    tools: [
      'logsentinel_status',
      'logsentinel_get_logs',
      'logsentinel_search_logs',
      'logsentinel_get_baselines',
      'logsentinel_service_improvement',
      'logsentinel_suggest_baselines'
    ]
  };
}

function buildCursorMcpSnippet(req) {
  const safe = getConfigSafe(req);
  const projectRoot = __dirname.replace(/\\/g, '/');
  return {
    mcpServers: {
      logsentinel: {
        command: 'node',
        args: [`${projectRoot}/mcp/logsentinel-mcp-server.cjs`],
        env: {
          LOGSENTINEL_URL: safe.publicUrl,
          LOGSENTINEL_MCP_API_KEY: '<your-api-key-from-admin>'
        }
      }
    }
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  getEffectiveApiKey,
  getEnvApiKey,
  isMcpApiEnabled,
  generateApiKey,
  getConfigSafe,
  getPublicUrl,
  buildCursorMcpSnippet
};
