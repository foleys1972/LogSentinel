import { LogEntry, MLAnomaly } from '../types';
import { subHours, isAfter } from 'date-fns';

const BASELINE_STORAGE_KEY = 'mlLearnedBaselines';
const MIN_SAMPLES_FOR_BASELINE = 10;
const LEARNING_WINDOW_HOURS = 168; // 7 days
const Z_SCORE_THRESHOLD = 2.5; // Flag when |z| > 2.5

export interface LearnedBaselines {
  version: number;
  updatedAt: string;
  siteLogFrequency: Record<string, { mean: number; std: number; sampleCount: number }>;
  siteErrorRate: Record<string, { mean: number; std: number; sampleCount: number }>;
  siteHourlyPattern: Record<string, number[]>; // 24 values, expected count per hour
  userErrorRate: Record<string, { mean: number; std: number; sampleCount: number }>;
  knownErrorPatterns: Record<string, { firstSeen: string; count: number }>;
  /** Message-based patterns (outside error codes) - e.g. keyword signatures */
  knownMessagePatterns: Record<string, { firstSeen: string; count: number }>;
}

function loadBaselines(): LearnedBaselines {
  try {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(BASELINE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as LearnedBaselines;
      if (parsed.version === 1) {
        if (!parsed.knownMessagePatterns) parsed.knownMessagePatterns = {};
        return parsed;
      }
    }
  } catch {
    /* ignore */
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

function saveBaselines(baselines: LearnedBaselines): void {
  try {
    baselines.updatedAt = new Date().toISOString();
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baselines));
  } catch {
    /* ignore */
  }
}

function computeMeanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 0.01; // Avoid division by zero
  return { mean, std };
}

export class MLAnomalyDetector {
  private logHistory: LogEntry[] = [];
  private baselines: LearnedBaselines = loadBaselines();

  constructor() {
    // Baselines are loaded from storage (learned from previous runs)
  }

  public addLogEntry(entry: LogEntry) {
    this.logHistory.push(entry);
    const cutoff = subHours(new Date(), 24);
    this.logHistory = this.logHistory.filter(log => isAfter(log.timestamp, cutoff));
  }

  public detectAnomalies(currentLogs: LogEntry[]): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];

    currentLogs.forEach(log => this.addLogEntry(log));

    // Learn from current data (update baselines)
    this.learnFromData();

    anomalies.push(...this.detectPatternAnomalies());
    anomalies.push(...this.detectBehaviorAnomalies());
    anomalies.push(...this.detectTimeSeriesAnomalies());
    anomalies.push(...this.detectThresholdAnomalies());
    anomalies.push(...this.detectClusteringAnomalies());
    anomalies.push(...this.detectMessagePatternAnomalies());
    anomalies.push(...this.detectUnrecognizedIssues());

    return anomalies.sort((a, b) => b.score - a.score);
  }

  /**
   * Learn baselines from actual log history (rolling window)
   */
  private learnFromData(): void {
    const cutoff = subHours(new Date(), LEARNING_WINDOW_HOURS);
    const recentLogs = this.logHistory.filter(log => isAfter(log.timestamp, cutoff));
    if (recentLogs.length < MIN_SAMPLES_FOR_BASELINE) return;

    const siteGroups = this.groupLogsBySite();
    const siteIds = Object.keys(siteGroups);

    // Learn log frequency per site (logs per hour over last 24 hours)
    const hourlyCounts: Record<string, number[]> = {};
    siteIds.forEach(sid => {
      hourlyCounts[sid] = new Array(24).fill(0);
      siteGroups[sid].forEach(log => {
        const hour = log.timestamp.getHours();
        hourlyCounts[sid][hour]++;
      });
    });

    siteIds.forEach(siteId => {
      const logs = siteGroups[siteId];
      const lastHourLogs = logs.filter(log => isAfter(log.timestamp, subHours(new Date(), 1)));
      const freq = lastHourLogs.length;
      const baseline = this.baselines.siteLogFrequency[siteId] || { mean: 0, std: 1, sampleCount: 0 };
      const newMean = baseline.sampleCount === 0
        ? freq
        : (baseline.mean * baseline.sampleCount + freq) / (baseline.sampleCount + 1);
      const newStd = baseline.sampleCount < 5
        ? Math.max(1, Math.abs(freq - newMean))
        : Math.sqrt(
            baseline.std ** 2 * baseline.sampleCount +
            (freq - newMean) ** 2
          ) / baseline.sampleCount;
      this.baselines.siteLogFrequency[siteId] = {
        mean: newMean,
        std: Math.max(0.01, newStd),
        sampleCount: Math.min(baseline.sampleCount + 1, 1000)
      };
    });

    // Learn error rate per site
    siteIds.forEach(siteId => {
      const logs = siteGroups[siteId];
      const lastHourLogs = logs.filter(log => isAfter(log.timestamp, subHours(new Date(), 1)));
      if (lastHourLogs.length < 3) return;
      const errorCount = lastHourLogs.filter(log => ['critical', 'high'].includes(log.level)).length;
      const errorRate = errorCount / lastHourLogs.length;
      const baseline = this.baselines.siteErrorRate[siteId] || { mean: 0.05, std: 0.05, sampleCount: 0 };
      const newMean = baseline.sampleCount === 0
        ? errorRate
        : (baseline.mean * baseline.sampleCount + errorRate) / (baseline.sampleCount + 1);
      const newStd = baseline.sampleCount < 5
        ? 0.05
        : Math.max(0.01, Math.abs(errorRate - newMean) * 0.5 + baseline.std * 0.5);
      this.baselines.siteErrorRate[siteId] = {
        mean: newMean,
        std: newStd,
        sampleCount: Math.min(baseline.sampleCount + 1, 1000)
      };
    });

    // Learn hourly pattern per site
    siteIds.forEach(siteId => {
      const counts = hourlyCounts[siteId] || new Array(24).fill(0);
      const existing = this.baselines.siteHourlyPattern[siteId] || new Array(24).fill(50);
      const learned = counts.map((c, i) => {
        if (counts.reduce((a, b) => a + b, 0) < 10) return existing[i];
        return existing[i] * 0.7 + c * 0.3; // Exponential moving average
      });
      this.baselines.siteHourlyPattern[siteId] = learned;
    });

    // Learn known error patterns
    recentLogs.forEach(log => {
      if (log.errorCode) {
        const pattern = `${log.source}_${log.errorCode}`;
        const existing = this.baselines.knownErrorPatterns[pattern];
        if (!existing) {
          this.baselines.knownErrorPatterns[pattern] = {
            firstSeen: new Date().toISOString(),
            count: 1
          };
        } else {
          existing.count++;
        }
      }
    });

    // Learn message patterns (outside error codes) - for logs without errorCode
    if (!this.baselines.knownMessagePatterns) this.baselines.knownMessagePatterns = {};
    recentLogs.forEach(log => {
      if (!log.errorCode && log.message) {
        const sig = this.getMessageSignature(log.message);
        if (sig) {
          const pattern = `${log.source}_${sig}`;
          const existing = this.baselines.knownMessagePatterns[pattern];
          if (!existing) {
            this.baselines.knownMessagePatterns[pattern] = {
              firstSeen: new Date().toISOString(),
              count: 1
            };
          } else {
            existing.count++;
          }
        }
      }
    });

    saveBaselines(this.baselines);
  }

  private detectPatternAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const siteGroups = this.groupLogsBySite();

    Object.entries(siteGroups).forEach(([siteId, logs]) => {
      const recentLogs = logs.filter(log => isAfter(log.timestamp, subHours(new Date(), 1)));
      const currentFrequency = recentLogs.length;
      const baseline = this.baselines.siteLogFrequency[siteId];
      if (!baseline || baseline.sampleCount < MIN_SAMPLES_FOR_BASELINE) return;

      const zScore = (currentFrequency - baseline.mean) / baseline.std;
      if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
        const score = Math.min(100, Math.abs(zScore) * 25);
        anomalies.push({
          id: `pattern_${siteId}_${Date.now()}`,
          timestamp: new Date(),
          siteId,
          siteName: logs[0]?.siteName || 'Unknown',
          type: 'pattern',
          score,
          description: `Log frequency ${currentFrequency > baseline.mean ? 'spike' : 'drop'} detected (z=${zScore.toFixed(1)})`,
          details: {
            baseline: baseline.mean,
            current: currentFrequency,
            pattern: 'frequency_deviation',
            confidence: Math.min(95, score)
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  private detectBehaviorAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const userActivity = this.analyzeUserBehavior();

    Object.entries(userActivity).forEach(([userId, activity]) => {
      const baseline = this.baselines.userErrorRate[userId] || { mean: 0.05, std: 0.05, sampleCount: 0 };
      const zScore = baseline.std > 0 ? (activity.errorRate - baseline.mean) / baseline.std : 0;
      if (zScore > Z_SCORE_THRESHOLD || (activity.errorRate > 0.3 && baseline.sampleCount < 5)) {
        const score = Math.min(100, activity.errorRate * 100);
        anomalies.push({
          id: `behavior_${userId}_${Date.now()}`,
          timestamp: new Date(),
          siteId: activity.primarySite,
          siteName: activity.siteName,
          type: 'behavior',
          score,
          description: `Abnormal user behavior: high error rate for ${userId}`,
          details: {
            baseline: baseline.mean,
            current: activity.errorRate,
            pattern: 'user_error_spike',
            confidence: 85
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  private detectTimeSeriesAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const hourlyData = this.getHourlyLogCounts();

    Object.entries(hourlyData).forEach(([siteId, hourlyCounts]) => {
      const expectedPattern = this.baselines.siteHourlyPattern[siteId];
      if (!expectedPattern || expectedPattern.every(v => v === 0)) return;

      const currentHour = new Date().getHours();
      const expected = expectedPattern[currentHour] || 50;
      const actual = hourlyCounts[currentHour] || 0;
      const deviation = expected > 0 ? Math.abs(actual - expected) / expected : 0;

      if (deviation > 0.5) {
        const score = Math.min(100, deviation * 100);
        anomalies.push({
          id: `timeseries_${siteId}_${Date.now()}`,
          timestamp: new Date(),
          siteId,
          siteName: this.getSiteName(siteId),
          type: 'timeseries',
          score,
          description: 'Seasonal pattern deviation detected',
          details: {
            baseline: expected,
            current: actual,
            pattern: 'hourly_pattern',
            confidence: 90
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  private detectThresholdAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const siteGroups = this.groupLogsBySite();

    Object.entries(siteGroups).forEach(([siteId, logs]) => {
      const recentLogs = logs.filter(log => isAfter(log.timestamp, subHours(new Date(), 1)));
      if (recentLogs.length < 5) return;

      const errorLogs = recentLogs.filter(log => ['critical', 'high'].includes(log.level));
      const errorRate = errorLogs.length / recentLogs.length;
      const baseline = this.baselines.siteErrorRate[siteId] || { mean: 0.15, std: 0.05, sampleCount: 0 };
      const threshold = baseline.mean + Z_SCORE_THRESHOLD * baseline.std;

      if (errorRate > threshold) {
        const score = Math.min(100, (errorRate / Math.max(0.01, threshold)) * 60);
        anomalies.push({
          id: `threshold_${siteId}_${Date.now()}`,
          timestamp: new Date(),
          siteId,
          siteName: logs[0]?.siteName || 'Unknown',
          type: 'threshold',
          score,
          description: 'Error rate exceeded learned baseline',
          details: {
            baseline: threshold,
            current: errorRate,
            pattern: 'error_rate_spike',
            confidence: 95
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect anomalies from message content outside of error codes.
   * Looks for keyword patterns (timeout, failed, exception, etc.) and clusters them.
   */
  private detectMessagePatternAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const messagePatterns = this.analyzeMessagePatterns();
    const known = this.baselines.knownMessagePatterns || {};

    Object.entries(messagePatterns).forEach(([pattern, info]) => {
      const knownInfo = known[pattern];
      const isNew = !knownInfo || (knownInfo.count < 3 && info.frequency > 5);
      if (isNew && info.frequency > 5) {
        const score = Math.min(100, info.frequency * 10);
        anomalies.push({
          id: `msgpattern_${pattern.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`,
          timestamp: new Date(),
          siteId: info.primarySite,
          siteName: info.siteName,
          type: 'pattern',
          score,
          description: `New message pattern (outside error codes): ${info.signature}`,
          details: {
            baseline: knownInfo?.count ?? 0,
            current: info.frequency,
            pattern: 'message_pattern',
            confidence: 75
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  /**
   * Detect high-severity logs that have no error code - potential unrecognized issues.
   */
  private detectUnrecognizedIssues(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const cutoff = subHours(new Date(), 1);
    const recentLogs = this.logHistory.filter(log => isAfter(log.timestamp, cutoff));

    const unrecognized = recentLogs.filter(
      log => !log.errorCode && ['critical', 'high'].includes(log.level)
    );

    if (unrecognized.length >= 3) {
      const bySite = unrecognized.reduce((acc, log) => {
        acc[log.siteId] = (acc[log.siteId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(bySite).forEach(([siteId, count]) => {
        if (count >= 3) {
          const sample = unrecognized.find(l => l.siteId === siteId);
          anomalies.push({
            id: `unrecognized_${siteId}_${Date.now()}`,
            timestamp: new Date(),
            siteId,
            siteName: sample?.siteName || 'Unknown',
            type: 'threshold',
            score: Math.min(100, count * 20),
            description: `${count} high-severity logs without recognized error codes - possible unknown issue`,
            details: {
              baseline: 0,
              current: count,
              pattern: 'unrecognized_high_severity',
              confidence: 70
            },
            severity: count >= 5 ? 'critical' : 'high'
          });
        }
      });
    }

    return anomalies;
  }

  private detectClusteringAnomalies(): MLAnomaly[] {
    const anomalies: MLAnomaly[] = [];
    const errorPatterns = this.analyzeErrorPatterns();

    Object.entries(errorPatterns).forEach(([pattern, info]) => {
      const known = this.baselines.knownErrorPatterns[pattern];
      const isNew = !known || (known.count < 3 && info.frequency > 5);
      if (isNew && info.frequency > 5) {
        const score = Math.min(100, info.frequency * 10);
        anomalies.push({
          id: `clustering_${pattern}_${Date.now()}`,
          timestamp: new Date(),
          siteId: info.primarySite,
          siteName: info.siteName,
          type: 'clustering',
          score,
          description: `New error pattern cluster identified: ${pattern}`,
          details: {
            baseline: known?.count ?? 0,
            current: info.frequency,
            pattern: 'new_error_cluster',
            confidence: 80
          },
          severity: score > 80 ? 'critical' : score > 60 ? 'high' : 'medium'
        });
      }
    });

    return anomalies;
  }

  private groupLogsBySite(): Record<string, LogEntry[]> {
    return this.logHistory.reduce((groups, log) => {
      if (!groups[log.siteId]) groups[log.siteId] = [];
      groups[log.siteId].push(log);
      return groups;
    }, {} as Record<string, LogEntry[]>);
  }

  private analyzeUserBehavior(): Record<string, { errorRate: number; primarySite: string; siteName: string }> {
    const userActivity: Record<string, { totalLogs: number; errorLogs: number; primarySite: string; siteName: string }> = {};

    this.logHistory.forEach(log => {
      if (log.userId) {
        if (!userActivity[log.userId]) {
          userActivity[log.userId] = { totalLogs: 0, errorLogs: 0, primarySite: log.siteId, siteName: log.siteName };
        }
        userActivity[log.userId].totalLogs++;
        if (['critical', 'high'].includes(log.level)) {
          userActivity[log.userId].errorLogs++;
        }
      }
    });

    const result: Record<string, { errorRate: number; primarySite: string; siteName: string }> = {};
    Object.entries(userActivity).forEach(([userId, a]) => {
      result[userId] = {
        errorRate: a.totalLogs > 0 ? a.errorLogs / a.totalLogs : 0,
        primarySite: a.primarySite,
        siteName: a.siteName
      };
    });
    return result;
  }

  private getHourlyLogCounts(): Record<string, number[]> {
    const hourlyCounts: Record<string, number[]> = {};
    Object.entries(this.groupLogsBySite()).forEach(([siteId, logs]) => {
      hourlyCounts[siteId] = new Array(24).fill(0);
      logs.forEach(log => {
        hourlyCounts[siteId][log.timestamp.getHours()]++;
      });
    });
    return hourlyCounts;
  }

  /** Extract a normalized signature from message for pattern matching (outside error codes) */
  private getMessageSignature(message: string): string | null {
    const upper = message.toUpperCase();
    const keywords = [
      'TIMEOUT', 'FAILED', 'FAILURE', 'EXCEPTION', 'ERROR', 'CRITICAL',
      'CONNECTION REFUSED', 'OUT OF MEMORY', 'DISK FULL', 'UNAVAILABLE',
      'DENIED', 'REJECTED', 'ABORTED', 'CANCELLED', 'DEADLOCK',
      'STACK OVERFLOW', 'NULL POINTER', 'SOCKET', 'NETWORK'
    ];
    const found = keywords.filter(kw => upper.includes(kw));
    if (found.length === 0) return null;
    return found.sort().slice(0, 3).join('_'); // Up to 3 keywords for signature
  }

  private analyzeMessagePatterns(): Record<string, { frequency: number; signature: string; primarySite: string; siteName: string }> {
    const patterns: Record<string, { frequency: number; signature: string; primarySite: string; siteName: string }> = {};
    const lastHour = subHours(new Date(), 1);

    this.logHistory
      .filter(log => isAfter(log.timestamp, lastHour) && !log.errorCode && log.message)
      .forEach(log => {
        const sig = this.getMessageSignature(log.message);
        if (sig) {
          const pattern = `${log.source}_${sig}`;
          if (!patterns[pattern]) {
            patterns[pattern] = { frequency: 0, signature: sig, primarySite: log.siteId, siteName: log.siteName };
          }
          patterns[pattern].frequency++;
        }
      });

    return patterns;
  }

  private analyzeErrorPatterns(): Record<string, { frequency: number; isNew: boolean; primarySite: string; siteName: string }> {
    const patterns: Record<string, { frequency: number; primarySite: string; siteName: string }> = {};

    this.logHistory.forEach(log => {
      if (log.errorCode) {
        const pattern = `${log.source}_${log.errorCode}`;
        if (!patterns[pattern]) {
          patterns[pattern] = { frequency: 0, primarySite: log.siteId, siteName: log.siteName };
        }
        patterns[pattern].frequency++;
      }
    });

    const result: Record<string, { frequency: number; isNew: boolean; primarySite: string; siteName: string }> = {};
    Object.entries(patterns).forEach(([pattern, info]) => {
      const known = this.baselines.knownErrorPatterns[pattern];
      result[pattern] = {
        ...info,
        isNew: !known || known.count < 3
      };
    });
    return result;
  }

  private getSiteName(siteId: string): string {
    const siteNames: Record<string, string> = {
      site_1: 'Downtown Headquarters',
      site_2: 'North Branch Office',
      site_3: 'Tech Campus Alpha',
      site_4: 'Distribution Center West',
      site_5: 'Regional Hub East'
    };
    return siteNames[siteId] || 'Unknown Site';
  }
}
