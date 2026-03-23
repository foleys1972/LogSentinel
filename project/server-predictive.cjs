/**
 * Server-side predictive analytics.
 * Runs failure prediction, capacity forecasting, and seasonal pattern detection
 * on log history. Broadcasts predictions to WebSocket clients.
 */

const { subHours, subDays, addHours, isAfter, isBefore } = require('date-fns');

const PREDICTION_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes
const FAILURE_THRESHOLD = 0.8;
const CAPACITY_WARNING_THRESHOLD = 0.75;
const SEASONAL_CONFIDENCE_THRESHOLD = 0.7;

let sites = [];
let recentAnomalies = [];
let getLogHistory = () => [];
let broadcastPredictions = () => {};
let predictionTimer = null;

function toDate(ts) {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

function setSites(newSites) {
  sites = newSites || [];
}

function addAnomaly(anomaly) {
  recentAnomalies.push({ ...anomaly, timestamp: toDate(anomaly.timestamp) });
  const cutoff = subHours(new Date(), 24);
  recentAnomalies = recentAnomalies.filter((a) => isAfter(toDate(a.timestamp), cutoff));
}

function setLogHistoryGetter(fn) {
  getLogHistory = fn || (() => []);
}

function calculateErrorRate(logs) {
  if (!logs.length) return 0;
  const errorLogs = logs.filter((l) => ['critical', 'high'].includes(l.level));
  return errorLogs.length / logs.length;
}

function calculateAnomalyScore(anomalies) {
  if (!anomalies.length) return 0;
  const avg = anomalies.reduce((s, a) => s + a.score, 0) / anomalies.length;
  return avg / 100;
}

function calculateHealthTrend(site) {
  if (!site?.healthHistory?.length || site.healthHistory.length < 2) {
    return (site?.healthScore ?? 80) / 100;
  }
  const recent = site.healthHistory.slice(-5);
  const trend = recent[recent.length - 1].score - recent[0].score;
  return Math.max(0, Math.min(1, (site.healthScore + trend) / 100));
}

function calculateResourceStress(logs) {
  const memoryWarnings = logs.filter((l) =>
    (l.message || '').toLowerCase().includes('memory') || l.errorCode === 'SYS_001'
  ).length;
  const diskWarnings = logs.filter((l) =>
    (l.message || '').toLowerCase().includes('disk') || l.errorCode === 'DISK_001'
  ).length;
  const networkIssues = logs.filter((l) =>
    (l.message || '').toLowerCase().includes('network') || l.errorCode === 'NET_001'
  ).length;
  const total = memoryWarnings + diskWarnings + networkIssues;
  return Math.min(1, total / Math.max(logs.length, 1) * 10);
}

function calculateErrorAcceleration(logs) {
  const now = new Date();
  const hour1 = logs.filter(
    (l) => isAfter(toDate(l.timestamp), subHours(now, 1)) && ['critical', 'high'].includes(l.level)
  ).length;
  const hour2 = logs.filter(
    (l) =>
      isAfter(toDate(l.timestamp), subHours(now, 2)) &&
      isBefore(toDate(l.timestamp), subHours(now, 1)) &&
      ['critical', 'high'].includes(l.level)
  ).length;
  return hour1 > hour2 ? (hour1 - hour2) / Math.max(hour2, 1) : 0;
}

function getHistoricalLogVolume(siteId, logs, days) {
  const volumes = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const dayStart = subDays(now, i);
    const dayEnd = addHours(dayStart, 24);
    const dayLogs = logs.filter(
      (l) =>
        l.siteId === siteId &&
        isAfter(toDate(l.timestamp), dayStart) &&
        isBefore(toDate(l.timestamp), dayEnd)
    );
    volumes.push(dayLogs.length);
  }
  return volumes;
}

function getCurrentLogVolume(siteId, logs) {
  const now = new Date();
  return logs.filter(
    (l) => l.siteId === siteId && isAfter(toDate(l.timestamp), subHours(now, 24))
  ).length;
}

function calculateVolumeTrend(volumes) {
  if (volumes.length < 2) return 0;
  const n = volumes.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = volumes.reduce((s, v) => s + v, 0);
  const sumXY = volumes.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = volumes.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
}

function estimateLogCapacity(site) {
  const base = 10000;
  const configMult = site?.monitoringConfig?.filePatterns?.length || 1;
  const recursiveMult = site?.monitoringConfig?.recursive ? 2 : 1;
  return base * configMult * recursiveMult;
}

function calculateTimeToCapacity(current, trend, capacity) {
  if (trend <= 0) return Infinity;
  return Math.max(0, (capacity - current) / trend);
}

function predictFailures(logs, anomalies) {
  const predictions = [];
  const now = new Date();

  for (const site of sites) {
    const recentLogs = logs.filter(
      (l) => l.siteId === site.id && isAfter(toDate(l.timestamp), subHours(now, 6))
    );
    const siteAnomalies = anomalies.filter(
      (a) => a.siteId === site.id && isAfter(toDate(a.timestamp), subHours(now, 2))
    );

    const errorRate = calculateErrorRate(recentLogs);
    const anomalyScore = calculateAnomalyScore(siteAnomalies);
    const healthTrend = calculateHealthTrend(site);
    const resourceStress = calculateResourceStress(recentLogs);

    const failureProbability =
      errorRate * 0.3 + anomalyScore * 0.25 + (1 - healthTrend) * 0.25 + resourceStress * 0.2;

    if (failureProbability > FAILURE_THRESHOLD) {
      const accel = calculateErrorAcceleration(recentLogs);
      const baseTime = 4;
      const timeToFailure = Math.max(
        0.5,
        (baseTime * (1 - failureProbability)) / Math.max(accel, 0.1)
      );

      predictions.push({
        type: 'failure',
        confidence: Math.min(95, failureProbability * 100),
        timeToEvent: timeToFailure,
        description: `High probability of system failure detected for ${site.name}`,
        recommendedActions: [
          'Investigate recent error patterns',
          'Check system resources',
          'Review recent deployments',
          'Prepare rollback procedures',
          'Alert on-call team'
        ],
        affectedSites: [site.id],
        timestamp: now.toISOString()
      });
    }
  }

  return predictions.sort((a, b) => b.confidence - a.confidence);
}

function forecastCapacity(logs) {
  const forecasts = [];
  const now = new Date();

  for (const site of sites) {
    const historicalData = getHistoricalLogVolume(site.id, logs, 7);
    const currentVolume = getCurrentLogVolume(site.id, logs);
    const trend = calculateVolumeTrend(historicalData);
    const predictedVolume = currentVolume + trend * 24;
    const estimatedCapacity = estimateLogCapacity(site);
    const utilizationRate = predictedVolume / estimatedCapacity;

    if (utilizationRate > CAPACITY_WARNING_THRESHOLD) {
      const timeToCapacity = calculateTimeToCapacity(
        currentVolume,
        trend,
        estimatedCapacity * 0.9
      );

      forecasts.push({
        siteId: site.id,
        siteName: site.name,
        currentLogVolume: currentVolume,
        predictedVolume,
        capacityUtilization: utilizationRate,
        timeToCapacity,
        recommendedActions: [
          'Scale log processing infrastructure',
          'Implement log rotation policies',
          'Archive older logs',
          'Optimize log parsing efficiency',
          'Consider distributed processing'
        ],
        timestamp: now.toISOString()
      });
    }
  }

  return forecasts.sort((a, b) => b.capacityUtilization - a.capacityUtilization);
}

function getNextBusinessHour() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

function getNextWeekday() {
  const now = new Date();
  const next = new Date(now);
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  return next;
}

function getNextMonthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

function getWeekNumber(date) {
  const d = toDate(date);
  const first = new Date(d.getFullYear(), 0, 1);
  const past = (d.getTime() - first.getTime()) / 86400000;
  return Math.ceil((past + first.getDay() + 1) / 7);
}

function detectSeasonalPatterns(logs) {
  const patterns = [];
  const logsWithDate = logs.map((l) => ({ ...l, ts: toDate(l.timestamp) }));

  // Hourly
  const hourlyVolumes = new Array(24).fill(0);
  logsWithDate.forEach((l) => hourlyVolumes[l.ts.getHours()]++);
  const avgHourly = hourlyVolumes.reduce((s, v) => s + v, 0) / 24;
  const peakHours = hourlyVolumes
    .map((v, h) => ({ hour: h, volume: v }))
    .filter(({ volume }) => volume > avgHourly * 1.5)
    .map(({ hour }) => `${hour}:00`);
  const variance = hourlyVolumes.reduce((s, v) => s + (v - avgHourly) ** 2, 0) / 24;
  const hourlyConf = Math.min(0.95, variance / (avgHourly * avgHourly || 1));
  if (hourlyConf > SEASONAL_CONFIDENCE_THRESHOLD) {
    patterns.push({
      pattern: 'hourly',
      description: 'Business hours show increased activity',
      peakTimes: peakHours,
      expectedIncrease: avgHourly > 0 ? (Math.max(...hourlyVolumes) / avgHourly) * 100 - 100 : 0,
      nextOccurrence: getNextBusinessHour().toISOString(),
      confidence: hourlyConf
    });
  }

  // Daily (weekday vs weekend)
  const dailyVolumes = new Array(7).fill(0);
  logsWithDate.forEach((l) => dailyVolumes[l.ts.getDay()]++);
  const weekdayAvg =
    (dailyVolumes[1] + dailyVolumes[2] + dailyVolumes[3] + dailyVolumes[4] + dailyVolumes[5]) / 5;
  const weekendAvg = (dailyVolumes[0] + dailyVolumes[6]) / 2;
  const dailyConf = Math.abs(weekdayAvg - weekendAvg) / Math.max(weekdayAvg, weekendAvg, 1);
  if (dailyConf > SEASONAL_CONFIDENCE_THRESHOLD) {
    patterns.push({
      pattern: 'daily',
      description: 'Weekdays show different patterns than weekends',
      peakTimes: weekdayAvg > weekendAvg ? ['Monday-Friday'] : ['Saturday-Sunday'],
      expectedIncrease:
        Math.min(weekdayAvg, weekendAvg) > 0
          ? (Math.abs(weekdayAvg - weekendAvg) / Math.min(weekdayAvg, weekendAvg)) * 100
          : 0,
      nextOccurrence: getNextWeekday().toISOString(),
      confidence: Math.min(0.95, dailyConf)
    });
  }

  // Monthly
  const monthEndLogs = logsWithDate.filter((l) => {
    const date = l.ts.getDate();
    const lastDay = new Date(l.ts.getFullYear(), l.ts.getMonth() + 1, 0).getDate();
    return date >= lastDay - 2;
  });
  const monthEndRatio = logsWithDate.length > 0 ? monthEndLogs.length / logsWithDate.length : 0;
  const monthlyConf = monthEndRatio > 0.15 ? 0.8 : 0.3;
  if (monthlyConf > SEASONAL_CONFIDENCE_THRESHOLD) {
    patterns.push({
      pattern: 'monthly',
      description: 'Month-end processing increases log volume',
      peakTimes: ['Month-end'],
      expectedIncrease: monthEndRatio * 100,
      nextOccurrence: getNextMonthEnd().toISOString(),
      confidence: monthlyConf
    });
  }

  return patterns;
}

function runPredictions() {
  const logs = getLogHistory();
  if (logs.length < 20 || sites.length === 0) return;

  const logsWithDate = logs.map((l) => ({
    ...l,
    timestamp: toDate(l.timestamp)
  }));

  const predictions = predictFailures(logsWithDate, recentAnomalies);
  const capacityForecasts = forecastCapacity(logsWithDate);
  const seasonalPatterns = detectSeasonalPatterns(logsWithDate);

  const payload = {
    predictions,
    capacityForecasts,
    seasonalPatterns,
    timestamp: new Date().toISOString()
  };

  if (typeof broadcastPredictions === 'function') {
    broadcastPredictions(payload);
  }
}

function start(broadcastFn, logHistoryGetter) {
  broadcastPredictions = broadcastFn || (() => {});
  setLogHistoryGetter(logHistoryGetter);
  if (predictionTimer) clearInterval(predictionTimer);
  predictionTimer = setInterval(runPredictions, PREDICTION_INTERVAL_MS);
  runPredictions();
}

function stop() {
  if (predictionTimer) {
    clearInterval(predictionTimer);
    predictionTimer = null;
  }
}

module.exports = {
  setSites,
  addAnomaly,
  setLogHistoryGetter,
  start,
  stop,
  runPredictions
};
