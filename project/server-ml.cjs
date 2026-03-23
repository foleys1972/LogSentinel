/**
 * Server-side ML anomaly detection.
 * Runs statistical logic (Z-score, EMA, pattern matching) plus Isolation Forest.
 * Processes logs as they arrive and broadcasts anomalies to WebSocket clients.
 */

const { subHours, isAfter } = require('date-fns');
const path = require('path');
const fs = require('fs');

let IsolationForest;
try {
  IsolationForest = require('isolation-forest').IsolationForest;
} catch (e) {
  IsolationForest = null;
}

let llmEnrichment;
try {
  llmEnrichment = require('./llm-enrichment.cjs');
} catch (e) {
  llmEnrichment = null;
}

function getDataDir() {
  // When packaged, code runs from app.asar (read-only). Use a writable dir.
  if (__dirname.includes('app.asar')) {
    // __dirname = .../Web/resources/app.asar -> use .../Web (exe dir)
    return path.join(__dirname, '..', '..');
  }
  if (process.versions?.electron || process.pkg) {
    return path.dirname(process.execPath);
  }
  return __dirname;
}
const BASELINE_FILE = path.join(getDataDir(), '.ml-baselines.json');
const MIN_SAMPLES_FOR_BASELINE = 10;
const LEARNING_WINDOW_HOURS = 168;
const Z_SCORE_THRESHOLD = 2.5;
const DETECTION_INTERVAL_MS = 15000; // Run detection every 15 seconds
const IF_TRAINING_HOURS = 48; // Isolation Forest: use last 48h for training
const IF_ANOMALY_THRESHOLD = 0.6; // Score >= 0.6 = anomaly (paper: ~1 = definite anomaly)
const IF_MIN_TRAINING_SAMPLES = 32; // Need enough samples to train

let logHistory = [];
let baselines = loadBaselines();
let broadcastAnomalies = () => {};
let detectionTimer = null;

const ANOMALY_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours - don't re-emit same anomaly
const recentlyEmittedKeys = new Map(); // key -> timestamp

function loadBaselines() {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
      if (data.version === 1) {
        if (!data.knownMessagePatterns) data.knownMessagePatterns = {};
        return data;
      }
    }
  } catch (e) {
    console.warn('[ML] Could not load baselines:', e.message);
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    siteLogFrequency: {},
    siteErrorRate: {},
    siteHourlyPattern: {},
    userErrorRate: {},
    knownErrorPatterns: {},
    knownMessagePatterns: {}
  };
}

function saveBaselines() {
  try {
    baselines.updatedAt = new Date().toISOString();
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselines, null, 0));
  } catch (e) {
    console.warn('[ML] Could not save baselines:', e.message);
  }
}

function toDate(ts) {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

function addLogEntry(entry) {
  const log = {
    ...entry,
    timestamp: toDate(entry.timestamp)
  };
  logHistory.push(log);
  const cutoff = subHours(new Date(), Math.max(24, IF_TRAINING_HOURS));
  logHistory = logHistory.filter((l) => isAfter(toDate(l.timestamp), cutoff));
}

function groupLogsBySite() {
  const groups = {};
  for (const log of logHistory) {
    const sid = log.siteId || 'unknown';
    if (!groups[sid]) groups[sid] = [];
    groups[sid].push(log);
  }
  return groups;
}

function getMessageSignature(message) {
  if (!message || typeof message !== 'string') return null;
  const upper = message.toUpperCase();
  const keywords = [
    'TIMEOUT', 'FAILED', 'FAILURE', 'EXCEPTION', 'ERROR', 'CRITICAL',
    'CONNECTION REFUSED', 'OUT OF MEMORY', 'DISK FULL', 'UNAVAILABLE',
    'DENIED', 'REJECTED', 'ABORTED', 'CANCELLED', 'DEADLOCK',
    'STACK OVERFLOW', 'NULL POINTER', 'SOCKET', 'NETWORK'
  ];
  const found = keywords.filter((kw) => upper.includes(kw));
  if (found.length === 0) return null;
  return found.sort().slice(0, 3).join('_');
}

function getSiteName(siteId, siteGroups) {
  const logs = siteGroups[siteId];
  return logs?.[0]?.siteName || siteId || 'Unknown Site';
}

function learnFromData() {
  const cutoff = subHours(new Date(), LEARNING_WINDOW_HOURS);
  const recentLogs = logHistory.filter((l) => isAfter(toDate(l.timestamp), cutoff));
  if (recentLogs.length < MIN_SAMPLES_FOR_BASELINE) return;

  const siteGroups = groupLogsBySite();
  const siteIds = Object.keys(siteGroups);
  const now = new Date();
  const oneHourAgo = subHours(now, 1);

  for (const siteId of siteIds) {
    const logs = siteGroups[siteId];
    const lastHourLogs = logs.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo));
    const freq = lastHourLogs.length;
    const bl = baselines.siteLogFrequency[siteId] || { mean: 0, std: 1, sampleCount: 0 };
    const newMean = bl.sampleCount === 0 ? freq : (bl.mean * bl.sampleCount + freq) / (bl.sampleCount + 1);
    const newStd = bl.sampleCount < 5 ? Math.max(1, Math.abs(freq - newMean)) : Math.sqrt(bl.std ** 2 * bl.sampleCount + (freq - newMean) ** 2) / bl.sampleCount;
    baselines.siteLogFrequency[siteId] = { mean: newMean, std: Math.max(0.01, newStd), sampleCount: Math.min(bl.sampleCount + 1, 1000) };
  }

  for (const siteId of siteIds) {
    const logs = siteGroups[siteId];
    const lastHourLogs = logs.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo));
    if (lastHourLogs.length < 3) continue;
    const errorCount = lastHourLogs.filter((l) => ['critical', 'high'].includes(l.level)).length;
    const errorRate = errorCount / lastHourLogs.length;
    const bl = baselines.siteErrorRate[siteId] || { mean: 0.05, std: 0.05, sampleCount: 0 };
    const newMean = bl.sampleCount === 0 ? errorRate : (bl.mean * bl.sampleCount + errorRate) / (bl.sampleCount + 1);
    const newStd = bl.sampleCount < 5 ? 0.05 : Math.max(0.01, Math.abs(errorRate - newMean) * 0.5 + bl.std * 0.5);
    baselines.siteErrorRate[siteId] = { mean: newMean, std: newStd, sampleCount: Math.min(bl.sampleCount + 1, 1000) };
  }

  const userActivity = {};
  for (const log of recentLogs) {
    if (log.userId) {
      if (!userActivity[log.userId]) userActivity[log.userId] = { totalLogs: 0, errorLogs: 0 };
      userActivity[log.userId].totalLogs++;
      if (['critical', 'high'].includes(log.level)) userActivity[log.userId].errorLogs++;
    }
  }
  for (const [userId, a] of Object.entries(userActivity)) {
    const errorRate = a.totalLogs > 0 ? a.errorLogs / a.totalLogs : 0;
    const bl = baselines.userErrorRate[userId] || { mean: 0.05, std: 0.05, sampleCount: 0 };
    const newMean = bl.sampleCount === 0 ? errorRate : (bl.mean * bl.sampleCount + errorRate) / (bl.sampleCount + 1);
    const newStd = bl.sampleCount < 5 ? 0.05 : Math.max(0.01, Math.abs(errorRate - newMean) * 0.5 + bl.std * 0.5);
    baselines.userErrorRate[userId] = { mean: newMean, std: newStd, sampleCount: Math.min(bl.sampleCount + 1, 1000) };
  }

  const hourlyCounts = {};
  for (const sid of siteIds) {
    hourlyCounts[sid] = new Array(24).fill(0);
    siteGroups[sid].forEach((l) => {
      hourlyCounts[sid][toDate(l.timestamp).getHours()]++;
    });
  }
  for (const siteId of siteIds) {
    const counts = hourlyCounts[siteId] || new Array(24).fill(0);
    const existing = baselines.siteHourlyPattern[siteId] || new Array(24).fill(50);
    const total = counts.reduce((a, b) => a + b, 0);
    baselines.siteHourlyPattern[siteId] = counts.map((c, i) => (total < 10 ? existing[i] : existing[i] * 0.7 + c * 0.3));
  }

  for (const log of recentLogs) {
    if (log.errorCode) {
      const pattern = `${log.source || 'unknown'}_${log.errorCode}`;
      if (!baselines.knownErrorPatterns[pattern]) baselines.knownErrorPatterns[pattern] = { firstSeen: new Date().toISOString(), count: 0 };
      baselines.knownErrorPatterns[pattern].count++;
    }
  }

  if (!baselines.knownMessagePatterns) baselines.knownMessagePatterns = {};
  for (const log of recentLogs) {
    if (!log.errorCode && log.message) {
      const sig = getMessageSignature(log.message);
      if (sig) {
        const pattern = `${log.source || 'unknown'}_${sig}`;
        if (!baselines.knownMessagePatterns[pattern]) baselines.knownMessagePatterns[pattern] = { firstSeen: new Date().toISOString(), count: 0 };
        baselines.knownMessagePatterns[pattern].count++;
      } else if (['critical', 'high'].includes(log.level)) {
        const msg = String(log.message || '').substring(0, 100).replace(/\s+/g, ' ');
        if (msg.length >= 5) {
          const hash = msg.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
          const pattern = `${log.source || 'unknown'}_UNRECOGNIZED_${Math.abs(hash).toString(36)}`;
          if (!baselines.knownMessagePatterns[pattern]) baselines.knownMessagePatterns[pattern] = { firstSeen: new Date().toISOString(), count: 0 };
          baselines.knownMessagePatterns[pattern].count++;
        }
      }
    }
  }

  saveBaselines();
}

function detectAnomalies() {
  const anomalies = [];
  const siteGroups = groupLogsBySite();
  const now = new Date();
  const oneHourAgo = subHours(now, 1);

  for (const [siteId, logs] of Object.entries(siteGroups)) {
    const recentLogs = logs.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo));
    const currentFrequency = recentLogs.length;
    const bl = baselines.siteLogFrequency[siteId];
    if (bl && bl.sampleCount >= MIN_SAMPLES_FOR_BASELINE) {
      const zScore = (currentFrequency - bl.mean) / bl.std;
      if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
        const score = Math.min(100, Math.abs(zScore) * 25);
        anomalies.push({
          id: `pattern_${siteId}_${Date.now()}`,
          timestamp: now.toISOString(),
          siteId,
          siteName: logs[0]?.siteName || 'Unknown',
          type: 'pattern',
          score,
          description: `Log frequency ${currentFrequency > bl.mean ? 'spike' : 'drop'} detected (z=${zScore.toFixed(1)})`,
          details: { baseline: bl.mean, current: currentFrequency, pattern: 'frequency_deviation', confidence: Math.min(95, score) },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    }
  }

  const userActivity = {};
  for (const log of logHistory) {
    if (log.userId) {
      if (!userActivity[log.userId]) userActivity[log.userId] = { totalLogs: 0, errorLogs: 0, primarySite: log.siteId, siteName: log.siteName };
      userActivity[log.userId].totalLogs++;
      if (['critical', 'high'].includes(log.level)) userActivity[log.userId].errorLogs++;
    }
  }
  for (const [userId, a] of Object.entries(userActivity)) {
    const bl = baselines.userErrorRate[userId] || { mean: 0.05, std: 0.05, sampleCount: 0 };
    const errorRate = a.totalLogs > 0 ? a.errorLogs / a.totalLogs : 0;
    const zScore = bl.std > 0 ? (errorRate - bl.mean) / bl.std : 0;
    if (zScore > Z_SCORE_THRESHOLD || (errorRate > 0.3 && bl.sampleCount < 5)) {
      const score = Math.min(100, errorRate * 100);
      anomalies.push({
        id: `behavior_${userId}_${Date.now()}`,
        timestamp: now.toISOString(),
        siteId: a.primarySite,
        siteName: a.siteName,
        type: 'behavior',
        score,
        description: `Abnormal user behavior: high error rate for ${userId}`,
        details: { baseline: bl.mean, current: errorRate, pattern: 'user_error_spike', confidence: 85 },
        severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
      });
    }
  }

  const hourlyData = {};
  for (const [sid, logs] of Object.entries(siteGroups)) {
    hourlyData[sid] = new Array(24).fill(0);
    logs.forEach((l) => hourlyData[sid][toDate(l.timestamp).getHours()]++);
  }
  for (const [siteId, hourlyCounts] of Object.entries(hourlyData)) {
    const expectedPattern = baselines.siteHourlyPattern[siteId];
    if (!expectedPattern || expectedPattern.every((v) => v === 0)) continue;
    const currentHour = now.getHours();
    const expected = expectedPattern[currentHour] || 50;
    const actual = hourlyCounts[currentHour] || 0;
    const deviation = expected > 0 ? Math.abs(actual - expected) / expected : 0;
    const skipStaticDrop = actual === 0 && expected > 5;
    if (deviation > 0.7 && !skipStaticDrop) {
      const score = Math.min(100, deviation * 100);
      anomalies.push({
        id: `timeseries_${siteId}_${Date.now()}`,
        timestamp: now.toISOString(),
        siteId,
        siteName: getSiteName(siteId, siteGroups),
        type: 'timeseries',
        score,
        description: 'Seasonal pattern deviation detected',
        details: { baseline: expected, current: actual, pattern: 'hourly_pattern', confidence: 90 },
        severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
      });
    }
  }

  for (const [siteId, logs] of Object.entries(siteGroups)) {
    const recentLogs = logs.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo));
    if (recentLogs.length < 5) continue;
    const errorLogs = recentLogs.filter((l) => ['critical', 'high'].includes(l.level));
    const errorRate = errorLogs.length / recentLogs.length;
    const bl = baselines.siteErrorRate[siteId] || { mean: 0.15, std: 0.05, sampleCount: 0 };
    const threshold = bl.mean + Z_SCORE_THRESHOLD * bl.std;
    if (errorRate > threshold) {
      const score = Math.min(100, (errorRate / Math.max(0.01, threshold)) * 60);
      anomalies.push({
        id: `threshold_${siteId}_${Date.now()}`,
        timestamp: now.toISOString(),
        siteId,
        siteName: logs[0]?.siteName || 'Unknown',
        type: 'threshold',
        score,
        description: 'Error rate exceeded learned baseline',
        details: { baseline: threshold, current: errorRate, pattern: 'error_rate_spike', confidence: 95 },
        severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
      });
    }
  }

  const errorPatterns = {};
  for (const log of logHistory) {
    if (log.errorCode) {
      const pattern = `${log.source || 'unknown'}_${log.errorCode}`;
      if (!errorPatterns[pattern]) errorPatterns[pattern] = { frequency: 0, primarySite: log.siteId, siteName: log.siteName };
      errorPatterns[pattern].frequency++;
    }
  }
  const MIN_KNOWN_COUNT = 8;
  for (const [pattern, info] of Object.entries(errorPatterns)) {
    const known = baselines.knownErrorPatterns[pattern];
    const isNew = !known || (known.count < MIN_KNOWN_COUNT && info.frequency > 5);
    if (isNew && info.frequency > 5) {
      const score = Math.min(100, info.frequency * 10);
      anomalies.push({
        id: `clustering_${pattern}_${Date.now()}`,
        timestamp: now.toISOString(),
        siteId: info.primarySite,
        siteName: info.siteName,
        type: 'clustering',
        score,
        description: `New error pattern cluster identified: ${pattern}`,
        details: { baseline: known?.count ?? 0, current: info.frequency, pattern: 'new_error_cluster', confidence: 80 },
        severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
      });
    }
  }

  const messagePatterns = {};
  for (const log of logHistory.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo) && !l.errorCode && l.message)) {
    const sig = getMessageSignature(log.message);
    if (sig) {
      const pattern = `${log.source || 'unknown'}_${sig}`;
      if (!messagePatterns[pattern]) messagePatterns[pattern] = { frequency: 0, signature: sig, primarySite: log.siteId, siteName: log.siteName };
      messagePatterns[pattern].frequency++;
    }
  }
  for (const [pattern, info] of Object.entries(messagePatterns)) {
    const known = baselines.knownMessagePatterns[pattern];
    const isNew = !known || (known.count < MIN_KNOWN_COUNT && info.frequency > 5);
    if (isNew && info.frequency > 5) {
      const score = Math.min(100, info.frequency * 10);
      anomalies.push({
        id: `msgpattern_${pattern.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`,
        timestamp: now.toISOString(),
        siteId: info.primarySite,
        siteName: info.siteName,
        type: 'pattern',
        score,
        description: `New message pattern (outside error codes): ${info.signature}`,
        details: { baseline: known?.count ?? 0, current: info.frequency, pattern: 'message_pattern', confidence: 75 },
        severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
      });
    }
  }

  const unrecognized = logHistory.filter((l) => isAfter(toDate(l.timestamp), oneHourAgo) && !l.errorCode && ['critical', 'high'].includes(l.level));
  if (unrecognized.length >= 3) {
    const bySite = {};
    for (const l of unrecognized) {
      bySite[l.siteId] = (bySite[l.siteId] || 0) + 1;
    }
    for (const [siteId, count] of Object.entries(bySite)) {
      if (count >= 3) {
        const sample = unrecognized.find((l) => l.siteId === siteId);
        const msg = String(sample?.message || '').substring(0, 100).replace(/\s+/g, ' ');
        const hash = msg.length >= 5 ? msg.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) : 0;
        const patternKey = msg.length >= 5 ? `${sample?.source || 'unknown'}_UNRECOGNIZED_${Math.abs(hash).toString(36)}` : null;
        const known = patternKey ? baselines.knownMessagePatterns[patternKey] : null;
        if (known && known.count >= MIN_KNOWN_COUNT) continue;
        anomalies.push({
          id: `unrecognized_${siteId}_${Date.now()}`,
          timestamp: now.toISOString(),
          siteId,
          siteName: sample?.siteName || 'Unknown',
          type: 'threshold',
          score: Math.min(100, count * 20),
          description: `${count} high-severity logs without recognized error codes - possible unknown issue`,
          details: { baseline: 0, current: count, pattern: 'unrecognized_high_severity', confidence: 70 },
          severity: count >= 5 ? 'critical' : 'high'
        });
      }
    }
  }

  // Isolation Forest: multivariate anomaly detection (catches patterns Z-score may miss)
  if (IsolationForest) {
    const ifAnomalies = detectIsolationForestAnomalies(siteGroups, now);
    anomalies.push(...ifAnomalies);
  }

  return anomalies.sort((a, b) => b.score - a.score);
}

/**
 * Build feature vectors for Isolation Forest.
 * Each row = one (siteId, hour) window with: logCount, errorRate, hour, uniqueCodes, etc.
 */
function buildFeatureVectors(logs, siteGroups) {
  const cutoff = subHours(new Date(), IF_TRAINING_HOURS);
  const recentLogs = logs.filter((l) => isAfter(toDate(l.timestamp), cutoff));
  if (recentLogs.length < 10) return { training: [], current: [] };

  const siteIds = Object.keys(siteGroups);
  const featureKeys = ['logCount', 'errorRate', 'hour', 'uniqueCodes', 'uniqueSources', 'criticalCount', 'highCount', 'siteHash'];

  const windows = {}; // key: siteId_hour
  for (const log of recentLogs) {
    const d = toDate(log.timestamp);
    const hour = d.getHours();
    const key = `${log.siteId || 'unknown'}_${hour}`;
    if (!windows[key]) {
      windows[key] = {
        siteId: log.siteId || 'unknown',
        siteName: log.siteName || 'Unknown',
        hour,
        logCount: 0,
        errorCount: 0,
        criticalCount: 0,
        highCount: 0,
        uniqueCodes: new Set(),
        uniqueSources: new Set()
      };
    }
    const w = windows[key];
    w.logCount++;
    if (['critical', 'high'].includes(log.level)) {
      w.errorCount++;
      if (log.level === 'critical') w.criticalCount++;
      else w.highCount++;
    }
    if (log.errorCode) w.uniqueCodes.add(log.errorCode);
    if (log.source) w.uniqueSources.add(log.source);
  }

  const rows = [];
  const siteHash = (sid) => {
    let h = 0;
    for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) % 1000;
    return h;
  };

  for (const w of Object.values(windows)) {
    const errorRate = w.logCount > 0 ? w.errorCount / w.logCount : 0;
    rows.push({
      logCount: Math.min(w.logCount, 10000),
      errorRate,
      hour: w.hour,
      uniqueCodes: Math.min(w.uniqueCodes.size, 50),
      uniqueSources: Math.min(w.uniqueSources.size, 20),
      criticalCount: Math.min(w.criticalCount, 100),
      highCount: Math.min(w.highCount, 100),
      siteHash: siteHash(w.siteId),
      _meta: { siteId: w.siteId, siteName: w.siteName, hour: w.hour }
    });
  }

  const trainingRows = rows.map(({ _meta, ...rest }) => rest);
  return { training: trainingRows, current: rows, featureKeys };
}

function detectIsolationForestAnomalies(siteGroups, now) {
  const anomalies = [];
  const { training, current } = buildFeatureVectors(logHistory, siteGroups);
  if (training.length < IF_MIN_TRAINING_SAMPLES) return anomalies;

  try {
    const subsampleSize = Math.min(128, Math.max(32, Math.floor(training.length / 2)));
    const forest = new IsolationForest(50, subsampleSize);
    forest.fit(training);

    const currentForPredict = current.map(({ _meta, ...rest }) => rest);
    const scores = forest.predict(currentForPredict);
    const currentHour = now.getHours();
    for (let i = 0; i < current.length; i++) {
      const score = scores[i];
      const row = current[i];
      if (score >= IF_ANOMALY_THRESHOLD && row._meta) {
        const { siteId, siteName } = row._meta;
        const normScore = Math.min(100, score * 100);
        anomalies.push({
          id: `isolation_forest_${siteId}_${Date.now()}_${i}`,
          timestamp: now.toISOString(),
          siteId,
          siteName,
          type: 'isolation_forest',
          score: normScore,
          description: `Isolation Forest anomaly: unusual multivariate pattern (score=${score.toFixed(2)})`,
          details: {
            baseline: IF_ANOMALY_THRESHOLD,
            current: score,
            pattern: 'isolation_forest',
            confidence: Math.min(95, normScore)
          },
          severity: normScore > 80 ? 'critical' : normScore > 60 ? 'high' : 'medium'
        });
      }
    }
  } catch (e) {
    console.warn('[ML] Isolation Forest error:', e.message);
  }
  return anomalies;
}

function getAnomalyCooldownKey(a) {
  const pattern = a.details?.pattern || (a.description || '').substring(0, 80);
  return `${a.type}_${a.siteId}_${pattern}`;
}

async function runDetection() {
  if (logHistory.length < MIN_SAMPLES_FOR_BASELINE) return;
  learnFromData();
  const anomalies = detectAnomalies();
  const now = Date.now();
  for (const k of recentlyEmittedKeys.keys()) {
    if (now - recentlyEmittedKeys.get(k) > ANOMALY_COOLDOWN_MS) recentlyEmittedKeys.delete(k);
  }
  if (anomalies.length > 0 && typeof broadcastAnomalies === 'function') {
    for (const a of anomalies) {
      const key = getAnomalyCooldownKey(a);
      if (recentlyEmittedKeys.has(key)) continue;
      recentlyEmittedKeys.set(key, now);
      let toBroadcast = a;
      if (llmEnrichment && llmEnrichment.enrichAnomaly) {
        try {
          toBroadcast = await llmEnrichment.enrichAnomaly(a);
        } catch (e) {
          /* broadcast without enrichment */
        }
      }
      broadcastAnomalies(toBroadcast);
    }
  }
}

function feedLog(logEntry) {
  addLogEntry(logEntry);
}

function start(broadcastFn) {
  broadcastAnomalies = broadcastFn || (() => {});
  if (detectionTimer) clearInterval(detectionTimer);
  detectionTimer = setInterval(runDetection, DETECTION_INTERVAL_MS);
}

function stop() {
  if (detectionTimer) {
    clearInterval(detectionTimer);
    detectionTimer = null;
  }
}

function getLogHistory() {
  return [...logHistory];
}

function getBaselines() {
  return { ...baselines };
}

function applyBaselineUpdates(updates) {
  if (!updates) return { applied: 0, errors: [] };
  const errors = [];
  let applied = 0;
  if (Array.isArray(updates.addKnownErrorPatterns)) {
    for (const { source = 'unknown', errorCode } of updates.addKnownErrorPatterns) {
      if (!errorCode || typeof errorCode !== 'string') {
        errors.push('addKnownErrorPatterns: missing or invalid errorCode');
        continue;
      }
      const pattern = `${String(source).trim() || 'unknown'}_${String(errorCode).trim()}`;
      if (!baselines.knownErrorPatterns[pattern]) {
        baselines.knownErrorPatterns[pattern] = { firstSeen: new Date().toISOString(), count: 1 };
        applied++;
      }
    }
  }
  if (Array.isArray(updates.addKnownMessagePatterns)) {
    for (const { source = 'unknown', signature } of updates.addKnownMessagePatterns) {
      if (!signature || typeof signature !== 'string') {
        errors.push('addKnownMessagePatterns: missing or invalid signature');
        continue;
      }
      const sig = String(signature).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 80);
      if (!sig) continue;
      const pattern = `${String(source).trim() || 'unknown'}_${sig}`;
      if (!baselines.knownMessagePatterns[pattern]) {
        baselines.knownMessagePatterns[pattern] = { firstSeen: new Date().toISOString(), count: 1 };
        applied++;
      }
    }
  }
  if (applied > 0) saveBaselines();
  return { applied, errors };
}

module.exports = { feedLog, start, stop, runDetection, getLogHistory, getBaselines, applyBaselineUpdates };
