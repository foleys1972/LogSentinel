/**
 * LogSentinel MCP REST API
 * Enabled via Admin → MCP Integration or LOGSENTINEL_MCP_API_KEY env var.
 */

const mcpConfig = require('./mcp-config.cjs');

function registerMcpRoutes(app, { mlModule, llmModule, predictiveModule } = {}) {
  function requireMcpKey(req, res, next) {
    const apiKey = mcpConfig.getEffectiveApiKey();
    if (!mcpConfig.isMcpApiEnabled() || !apiKey) {
      return res.status(503).json({
        error:
          'MCP API disabled. Enable it in Admin → MCP Integration and set an API key, or set LOGSENTINEL_MCP_API_KEY on the server.'
      });
    }
    const auth = String(req.headers.authorization || '');
    const headerKey = req.headers['x-logsentinel-api-key'];
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : String(headerKey || '').trim();
    if (!token || token !== apiKey) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
  }

  function summarizeLog(log) {
    return {
      id: log.id,
      timestamp: log.timestamp,
      siteId: log.siteId,
      siteName: log.siteName,
      level: log.level,
      message: typeof log.message === 'string' ? log.message.slice(0, 2000) : log.message,
      source: log.source,
      errorCode: log.errorCode,
      ip: log.ip
    };
  }

  function filterLogs(logs, { siteId, level, search, since, until }) {
    let out = logs;
    if (siteId) {
      out = out.filter((l) => l.siteId === siteId || l.siteName === siteId);
    }
    if (level) {
      const lv = String(level).toLowerCase();
      out = out.filter((l) => String(l.level || '').toLowerCase() === lv);
    }
    if (search) {
      const q = String(search).toLowerCase();
      out = out.filter(
        (l) =>
          String(l.message || '').toLowerCase().includes(q) ||
          String(l.source || '').toLowerCase().includes(q) ||
          String(l.errorCode || '').toLowerCase().includes(q)
      );
    }
    if (since) {
      const t = new Date(since).getTime();
      if (!Number.isNaN(t)) {
        out = out.filter((l) => new Date(l.timestamp).getTime() >= t);
      }
    }
    if (until) {
      const t = new Date(until).getTime();
      if (!Number.isNaN(t)) {
        out = out.filter((l) => new Date(l.timestamp).getTime() <= t);
      }
    }
    return out;
  }

  app.get('/api/mcp/status', requireMcpKey, (_req, res) => {
    const logs = mlModule?.getLogHistory?.() || [];
    const baselines = mlModule?.getBaselines?.();
    res.json({
      ok: true,
      service: 'LogSentinel Enterprise',
      mcpApiVersion: '1.0.0',
      logCount: logs.length,
      modules: {
        ml: !!mlModule,
        llm: !!llmModule,
        predictive: !!predictiveModule
      },
      baselinesUpdatedAt: baselines?.updatedAt || null
    });
  });

  app.get('/api/mcp/logs', requireMcpKey, (req, res) => {
    if (!mlModule?.getLogHistory) {
      return res.status(503).json({ error: 'ML/log module not available' });
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 500);
    const logs = mlModule.getLogHistory();
    const filtered = filterLogs(logs, {
      siteId: req.query.siteId,
      level: req.query.level,
      search: req.query.search,
      since: req.query.since,
      until: req.query.until
    });
    const slice = filtered.slice(-limit).reverse().map(summarizeLog);
    res.json({
      totalMatching: filtered.length,
      returned: slice.length,
      logs: slice
    });
  });

  app.post('/api/mcp/search-logs', requireMcpKey, (req, res) => {
    if (!mlModule?.getLogHistory) {
      return res.status(503).json({ error: 'ML/log module not available' });
    }
    const { pattern, siteId, level, limit: rawLimit } = req.body || {};
    if (!pattern || typeof pattern !== 'string') {
      return res.status(400).json({ error: 'pattern (string) is required in JSON body' });
    }
    let regex;
    try {
      regex = new RegExp(pattern, 'i');
    } catch (e) {
      return res.status(400).json({ error: `Invalid regex: ${e.message}` });
    }
    const limit = Math.min(Math.max(parseInt(String(rawLimit || '50'), 10) || 50, 1), 200);
    const logs = filterLogs(mlModule.getLogHistory(), { siteId, level });
    const matches = logs.filter((l) => regex.test(String(l.message || ''))).slice(-limit).reverse();
    res.json({
      pattern,
      totalMatching: matches.length,
      logs: matches.map(summarizeLog)
    });
  });

  app.get('/api/mcp/baselines', requireMcpKey, (_req, res) => {
    if (!mlModule?.getBaselines) {
      return res.status(503).json({ error: 'ML module not available' });
    }
    const baselines = mlModule.getBaselines();
    res.json({
      updatedAt: baselines.updatedAt,
      siteLogFrequency: baselines.siteLogFrequency,
      siteErrorRate: baselines.siteErrorRate,
      knownErrorPatterns: baselines.knownErrorPatterns,
      knownMessagePatterns: baselines.knownMessagePatterns
    });
  });

  app.post('/api/mcp/service-improvement', requireMcpKey, async (req, res) => {
    if (!llmModule?.getServiceImprovementSuggestions) {
      return res.status(503).json({ error: 'LLM module not available or not configured' });
    }
    const context = req.body || {};
    if (!mlModule?.getLogHistory) {
      return res.status(503).json({ error: 'ML module not available' });
    }
    const enriched = {
      ...context,
      recentLogs: context.recentLogs ?? mlModule.getLogHistory().slice(-50).map(summarizeLog)
    };
    try {
      const result = await llmModule.getServiceImprovementSuggestions(enriched);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/mcp/update-baselines', requireMcpKey, async (req, res) => {
    if (!llmModule?.suggestBaselineUpdates || !mlModule?.getBaselines) {
      return res.status(503).json({ error: 'LLM/ML modules not available' });
    }
    const { context, apply } = req.body || {};
    try {
      const baselines = mlModule.getBaselines();
      const logs = mlModule.getLogHistory();
      const merged = {
        ...context,
        recentLogs: context?.recentLogs ?? logs.slice(-50).map(summarizeLog),
        knownErrorPatterns: context?.knownErrorPatterns ?? baselines.knownErrorPatterns,
        knownMessagePatterns: context?.knownMessagePatterns ?? baselines.knownMessagePatterns
      };
      const result = await llmModule.suggestBaselineUpdates(merged);
      if (!result.success) return res.json(result);
      if (apply && result.suggestions && mlModule.applyBaselineUpdates) {
        const applied = mlModule.applyBaselineUpdates(result.suggestions);
        return res.json({ ...result, applied });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { registerMcpRoutes };
