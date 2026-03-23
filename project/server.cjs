/**
 * LogSentinel Enterprise - Web Server
 * Serves the built React app so multiple users can browse to and use it.
 * WebSocket server streams file monitoring results to all connected browsers.
 * Access from other machines: http://<your-ip>:3000
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { networkInterfaces } = require('os');
const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');
const serverReady = new EventEmitter();
let applyConfig, stopAll;
try {
  const monitoring = require('./server-monitoring.cjs');
  applyConfig = monitoring.applyConfig;
  stopAll = monitoring.stopAll;
} catch (e) {
  console.warn('Server monitoring module not loaded:', e.message);
  applyConfig = () => {};
  stopAll = () => {};
}

let mlModule;
try {
  mlModule = require('./server-ml.cjs');
} catch (e) {
  mlModule = null;
}

let predictiveModule;
try {
  predictiveModule = require('./server-predictive.cjs');
} catch (e) {
  predictiveModule = null;
}

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function getDistPath() {
  if (process.env.ELECTRON_DIST_PATH) {
    return process.env.ELECTRON_DIST_PATH;
  }
  return path.join(__dirname, 'dist');
}

const distPath = getDistPath();

// ----- Auth & session -----
let authModule;
try {
  authModule = require('./server-auth.cjs');
  authModule.ensureDefaultAdmin();
} catch (e) {
  authModule = null;
}

if (authModule) {
  const session = require('express-session');
  app.use(session({
    secret: process.env.SESSION_SECRET || 'logsentinel-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
  }));

  const requireAuth = (req, res, next) => {
    const config = authModule.loadAuthConfig();
    if (!config.authRequired) return next();
    if (req.session && req.session.userId) return next();
    res.status(401).json({ error: 'Authentication required' });
  };

  app.get('/api/auth/config', (req, res) => {
    res.json(authModule.loadAuthConfig());
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = authModule.authenticate(username, password);
    if (!result.success) return res.status(401).json(result);
    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.fullName = result.user.fullName;
    req.session.email = result.user.email;
    req.session.mustChangePassword = result.user.mustChangePassword;
    res.json({ success: true, user: result.user });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = authModule.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Session invalid' });
    res.json({ ...user, mustChangePassword: req.session.mustChangePassword });
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    const result = authModule.updatePassword(req.session.userId, currentPassword, newPassword);
    if (!result.success) return res.status(400).json(result);
    req.session.mustChangePassword = false;
    res.json(result);
  });

  app.post('/api/auth/config', requireAuth, (req, res) => {
    const { authRequired, requireAcknowledgment, acknowledgmentSeverities } = req.body || {};
    const config = authModule.loadAuthConfig();
    if (authRequired !== undefined) config.authRequired = !!authRequired;
    if (requireAcknowledgment !== undefined) config.requireAcknowledgment = !!requireAcknowledgment;
    if (Array.isArray(acknowledgmentSeverities)) config.acknowledgmentSeverities = acknowledgmentSeverities;
    authModule.saveAuthConfig(config);
    res.json(config);
  });

  app.get('/api/auth/users', requireAuth, (req, res) => {
    res.json(authModule.listUsers());
  });

  app.post('/api/auth/users', requireAuth, (req, res) => {
    const result = authModule.createUser(req.body || {});
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  app.put('/api/auth/users/:id', requireAuth, (req, res) => {
    const result = authModule.updateUser(req.params.id, req.body || {});
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  app.delete('/api/auth/users/:id', requireAuth, (req, res) => {
    const result = authModule.deleteUser(req.params.id);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  app.post('/api/auth/users/:id/reset-password', requireAuth, (req, res) => {
    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ error: 'New password required' });
    const result = authModule.resetPasswordByAdmin(req.session.userId, req.params.id, newPassword);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && !req.path.startsWith('/api/auth/')) {
      return requireAuth(req, res, next);
    }
    next();
  });
}

function getLocalIPs() {
  const nets = networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws-monitoring' });

const clients = new Set();

function broadcastAnomaly(anomaly) {
  if (predictiveModule && predictiveModule.addAnomaly) predictiveModule.addAnomaly(anomaly);
  const msg = JSON.stringify({ type: 'new-anomaly', data: anomaly });
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

function broadcastPredictions(payload) {
  const msg = JSON.stringify({ type: 'predictions', data: payload });
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

function createLogBroadcast() {
  return (logEntry) => {
    broadcastLog(logEntry);
    if (mlModule) mlModule.feedLog(logEntry);
  };
}

let sendSnmpTrap;
try {
  const snmp = require('./snmp-trap-sender.cjs');
  sendSnmpTrap = snmp.sendTrap;
} catch (e) {
  sendSnmpTrap = null;
}

let llmModule;
try {
  llmModule = require('./llm-enrichment.cjs');
} catch (e) {
  llmModule = null;
}

app.get('/api/llm-config', (req, res) => {
  if (!llmModule) return res.status(503).json({ error: 'LLM module not available' });
  try {
    const config = llmModule.getConfigSafe();
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/llm-config', (req, res) => {
  if (!llmModule) return res.status(503).json({ error: 'LLM module not available' });
  const { enabled, model, apiKey, provider, baseUrl, deployment, continuousEvaluationEnabled, continuousEvaluationPrompt, continuousEvaluationIntervalMinutes } = req.body || {};
  try {
    const current = llmModule.loadConfig();
    current.enabled = enabled ?? current.enabled;
    current.model = model || current.model;
    if (provider !== undefined) current.provider = provider;
    if (baseUrl !== undefined) current.baseUrl = baseUrl;
    if (deployment !== undefined) current.deployment = deployment;
    if (apiKey !== undefined && apiKey !== '') current.apiKey = apiKey;
    if (continuousEvaluationEnabled !== undefined) current.continuousEvaluationEnabled = continuousEvaluationEnabled;
    if (continuousEvaluationPrompt !== undefined) current.continuousEvaluationPrompt = continuousEvaluationPrompt;
    if (continuousEvaluationIntervalMinutes !== undefined) current.continuousEvaluationIntervalMinutes = continuousEvaluationIntervalMinutes;
    llmModule.saveConfig(current);
    res.json(llmModule.getConfigSafe());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/llm-service-improvement', (req, res) => {
  if (!llmModule || !llmModule.getServiceImprovementSuggestions) {
    return res.status(503).json({ success: false, error: 'AI module not available' });
  }
  const context = req.body || {};
  llmModule.getServiceImprovementSuggestions(context)
    .then((result) => res.json(result))
    .catch((e) => res.status(500).json({ success: false, error: e.message }));
});

app.post('/api/llm-update-baselines', async (req, res) => {
  if (!llmModule || !llmModule.suggestBaselineUpdates) {
    return res.status(503).json({ success: false, error: 'AI module not available' });
  }
  if (!mlModule || !mlModule.getBaselines || !mlModule.applyBaselineUpdates) {
    return res.status(503).json({ success: false, error: 'ML module not available' });
  }
  const { context: userContext, apply } = req.body || {};
  try {
    const baselines = mlModule.getBaselines();
    const logs = mlModule.getLogHistory ? mlModule.getLogHistory() : [];
    const context = {
      ...userContext,
      recentLogs: userContext?.recentLogs ?? logs.slice(-50),
      knownErrorPatterns: userContext?.knownErrorPatterns ?? baselines.knownErrorPatterns,
      knownMessagePatterns: userContext?.knownMessagePatterns ?? baselines.knownMessagePatterns
    };
    const result = await llmModule.suggestBaselineUpdates(context);
    if (!result.success) return res.json(result);
    if (apply && result.suggestions) {
      const applied = mlModule.applyBaselineUpdates(result.suggestions);
      return res.json({ ...result, applied });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/snmp-trap', (req, res) => {
  if (!sendSnmpTrap) {
    return res.status(503).json({ error: 'SNMP trap forwarding not available (net-snmp required)' });
  }
  const { config, payload } = req.body || {};
  if (!config || !payload) {
    return res.status(400).json({ error: 'config and payload required' });
  }
  sendSnmpTrap(config, payload)
    .then(() => res.json({ success: true }))
    .catch((err) => {
      console.error('SNMP trap error:', err);
      res.status(500).json({ error: err.message });
    });
});

// Static files and SPA fallback (must be after API routes)
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

function broadcastLog(logEntry) {
  const msg = JSON.stringify({ type: 'new-log-entry', data: logEntry });
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

function broadcastLLMEvaluation(result) {
  const msg = JSON.stringify({ type: 'llm-evaluation-result', data: result });
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

let lastContinuousEvalRun = 0;
let continuousEvalTimer = null;

function runContinuousEvaluationTick() {
  if (!llmModule || !llmModule.runContinuousLogEvaluation || !mlModule || typeof mlModule.getLogHistory !== 'function') return;
  const config = llmModule.loadConfig();
  if (!config.continuousEvaluationEnabled || !config.continuousEvaluationPrompt?.trim()) return;
  const intervalMs = (config.continuousEvaluationIntervalMinutes || 5) * 60 * 1000;
  if (Date.now() - lastContinuousEvalRun < intervalMs) return;
  const logs = mlModule.getLogHistory();
  if (!logs || logs.length === 0) return;
  lastContinuousEvalRun = Date.now();
  llmModule.runContinuousLogEvaluation(logs, (result) => broadcastLLMEvaluation(result));
}

wss.on('connection', (ws, req) => {
  clients.add(ws);
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'monitoring-config' && msg.sites) {
        const broadcast = createLogBroadcast();
        applyConfig(msg.sites, broadcast);
        if (mlModule) mlModule.start(broadcastAnomaly);
        if (predictiveModule) {
          predictiveModule.setSites(msg.sites);
          const getLogHistory = mlModule && typeof mlModule.getLogHistory === 'function' ? mlModule.getLogHistory : () => [];
          predictiveModule.start(broadcastPredictions, getLogHistory);
        }
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });
  ws.on('close', () => {
    clients.delete(ws);
  });
});

function tryListen(port, host, onSuccess) {
  server.listen(port, host, () => {
    onSuccess(port);
  });
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 3010) {
      server.close(() => tryListen(port + 1, host, onSuccess));
    } else {
      console.error('Server failed to start:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is in use. Stop the other process or set PORT=3001 (etc.)`);
      }
      process.exit(1);
    }
  });
}

tryListen(PORT, HOST, (actualPort) => {
  serverReady.emit('ready', actualPort);
  if (!continuousEvalTimer) {
    continuousEvalTimer = setInterval(runContinuousEvaluationTick, 60000);
  }
  if (process.env.ELECTRON_RUN_AS_SUBPROCESS !== '1') {
    console.log('');
    console.log('========================================');
    console.log('  LogSentinel Enterprise - Web Server');
    console.log('========================================');
    console.log('');
    console.log(`  Local:   http://localhost:${actualPort}`);
    const ips = getLocalIPs();
    ips.forEach((ip) => console.log(`  Network: http://${ip}:${actualPort}`));
    console.log('');
    console.log('  Multiple users can browse to the URLs above.');
    console.log('');
  }
});

server.on('close', () => {
  if (continuousEvalTimer) {
    clearInterval(continuousEvalTimer);
    continuousEvalTimer = null;
  }
  stopAll();
  if (mlModule && mlModule.stop) mlModule.stop();
  if (predictiveModule && predictiveModule.stop) predictiveModule.stop();
});

module.exports = { server, app, wss, serverReady };
