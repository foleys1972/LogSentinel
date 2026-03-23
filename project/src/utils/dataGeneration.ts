import { Site, LogEntry, MLAnomaly, SystemMetrics, HealthDataPoint } from '../types';
import { addHours, subHours, subDays, format } from 'date-fns';
import { fileSystemMonitor } from './fileSystemMonitor';

export function generateSites(): Site[] {
  // Always return empty array - no default sites
  // Sites are only created through the admin panel
  return [];
}

// Remove the generateLogEntries and generateMLAnomalies functions
// These are now handled by the FileSystemMonitor

export function generateSystemMetrics(
  sites: Site[] = [],
  totalLogs: number = 0,
  anomaliesCount: number = 0,
  logs: LogEntry[] = []
): SystemMetrics {
  const siteCount = sites.length;
  const monitoredSiteCount = sites.filter(site =>
    site.monitoringConfig?.folderPath &&
    site.monitoringConfig.folderPath.trim() !== ''
  ).length;
  const activeSites = sites.filter(s => s.status !== 'red').length;
  const criticalSites = sites.filter(s => s.status === 'red').length;

  const totalCriticalAlerts = logs.length > 0
    ? logs.filter(l => l.level === 'critical' && !l.acknowledged).length
    : sites.reduce((sum, s) => sum + (s.alertCounts?.critical ?? 0), 0);
  const totalHighAlerts = logs.length > 0
    ? logs.filter(l => l.level === 'high' && !l.acknowledged).length
    : sites.reduce((sum, s) => sum + (s.alertCounts?.high ?? 0), 0);

  const systemHealth = computeSystemHealth(siteCount, activeSites, criticalSites, totalCriticalAlerts, totalHighAlerts, anomaliesCount);

  return {
    totalSites: siteCount,
    activeSites: activeSites,
    totalLogs: totalLogs,
    logsPerHour: monitoredSiteCount > 0 ? Math.floor(totalLogs / 24) : 0,
    anomaliesDetected: anomaliesCount,
    avgResponseTime: monitoredSiteCount > 0 ? 1 : 0,
    systemHealth,
    monitoringStats: getActualMonitoringStats(sites)
  };
}

function computeSystemHealth(
  totalSites: number,
  activeSites: number,
  criticalSites: number,
  criticalAlerts: number,
  highAlerts: number,
  anomaliesCount: number
): number {
  if (totalSites === 0) return 100;

  let baseHealth = (activeSites / totalSites) * 100;

  const criticalPenalty = Math.min(criticalAlerts * 10, 50);
  const highPenalty = Math.min(highAlerts * 3, 20);
  const anomalyPenalty = Math.min(anomaliesCount * 2, 15);
  const criticalSitePenalty = criticalSites * 15;

  const health = Math.max(0, Math.min(100, Math.round(baseHealth - criticalPenalty - highPenalty - anomalyPenalty - criticalSitePenalty)));
  return health;
}

function getActualMonitoringStats(sites: Site[]): SystemMetrics['monitoringStats'] {
  // Get actual stats from the file system monitor
  const actualStats = fileSystemMonitor.getCurrentStats();
  
  // Only count sites with valid monitoring paths
  const monitoredSites = sites.filter(site => 
    site.monitoringConfig?.folderPath && 
    site.monitoringConfig.folderPath.trim() !== '' &&
    isValidMonitoringPath(site.monitoringConfig.folderPath)
  );

  if (monitoredSites.length === 0) {
    return {
      filesMonitored: 0,
      foldersWatched: 0,
      tailProcesses: 0,
      bytesProcessed: 0,
      lastScanTime: new Date()
    };
  }

  return actualStats;
}

function isValidMonitoringPath(path: string): boolean {
  if (!path || path.trim() === '') return false;
  
  // Check for valid-looking paths
  const validPatterns = [
    /^\/var\/log/,           // Linux log directories
    /^\/opt\/.*\/logs/,      // Application log directories
    /^\/home\/.*\/logs/,     // User log directories
    /^C:\\.*\\[Ll]ogs/,      // Windows log directories
    /^\/usr\/local\/.*\/logs/, // Local application logs
  ];

  return validPatterns.some(pattern => pattern.test(path)) && 
         !path.includes('example') && 
         !path.includes('demo');
}

/** Generate chart data from real logs/sites, or empty when no monitoring */
export function generateChartData(
  days: number = 7,
  logs?: { timestamp: Date; siteId?: string; level?: string }[],
  sites?: { id: string; healthHistory?: { timestamp: Date; score: number; logCount: number }[] }[]
): Array<{ timestamp: Date; value: number; logCount?: number }> {
  const now = new Date();
  const data: Array<{ timestamp: Date; value: number; logCount?: number }> = [];

  const hasLogs = logs && logs.length > 0;
  const hasHealthHistory = sites?.some(s => (s.healthHistory?.length ?? 0) > 0);
  if (!hasLogs && !hasHealthHistory) return [];

  for (let i = days; i >= 0; i--) {
    const dayStart = subDays(now, i);
    const dayEnd = addHours(dayStart, 24);

    let logCount = 0;
    let healthSum = 0;
    let healthCount = 0;

    if (hasLogs) {
      logCount = logs!.filter(l => {
        const t = l.timestamp instanceof Date ? l.timestamp : new Date(l.timestamp);
        return t >= dayStart && t < dayEnd;
      }).length;
    }

    if (hasHealthHistory && sites) {
      for (const site of sites) {
        const points = site.healthHistory?.filter(p => {
          const t = p.timestamp instanceof Date ? p.timestamp : new Date(p.timestamp);
          return t >= dayStart && t < dayEnd;
        }) ?? [];
        for (const p of points) {
          healthSum += p.score;
          healthCount++;
        }
      }
    }

    const avgHealth = healthCount > 0 ? healthSum / healthCount : (logCount > 0 ? 90 : 0);
    data.push({ timestamp: dayStart, value: avgHealth, logCount });
  }

  const hasAnyData = data.some(d => d.value > 0 || (d.logCount ?? 0) > 0);
  return hasAnyData ? data : [];
}

export function initializeHealthHistory(): HealthDataPoint[] {
  const history: HealthDataPoint[] = [];
  const now = new Date();
  
  for (let i = 23; i >= 0; i--) {
    const timestamp = subHours(now, i);
    history.push({
      timestamp,
      score: Math.floor(Math.random() * 20) + 80,
      errorCount: Math.floor(Math.random() * 3),
      logCount: Math.floor(Math.random() * 50) + 10
    });
  }
  
  return history;
}