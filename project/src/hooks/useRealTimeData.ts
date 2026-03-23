import { useState, useEffect, useCallback, useMemo } from 'react';
import { Site, LogEntry, MLAnomaly, SystemMetrics } from '../types';
import type { ServerPredictionsPayload } from '../utils/predictiveAnalytics';
import { 
  generateSystemMetrics 
} from '../utils/dataGeneration';
import { MLAnomalyDetector } from '../utils/mlAlgorithms';
import { enrichLogData } from '../utils/dataEnrichment';
import { forwardTrap } from '../utils/snmpTrapForwarder';
import { HealthCalculator } from '../utils/healthCalculation';
import { fileSystemMonitor } from '../utils/fileSystemMonitor';

export function useRealTimeData() {
  const [sites, setSites] = useState<Site[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [anomalies, setAnomalies] = useState<MLAnomaly[]>([]);
  const [serverPredictions, setServerPredictions] = useState<ServerPredictionsPayload | null>(null);
  const [llmEvaluationResult, setLlmEvaluationResult] = useState<{ timestamp: string; evaluation: string; logCount: number } | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mlDetector] = useState(() => new MLAnomalyDetector());
  const [totalLogsProcessed, setTotalLogsProcessed] = useState(0);

  // Load sites from localStorage only
  const loadSites = useCallback(() => {
    const savedSites = localStorage.getItem('managedSites');
    if (savedSites) {
      try {
        const parsedSites = JSON.parse(savedSites);
        return parsedSites.map((site: any) => {
          // Migrate legacy folderMonitoringSystemType to folderMonitoringTypes
          let folderMonitoringTypes = site.folderMonitoringTypes ?? [];
          if (folderMonitoringTypes.length === 0 && site.folderMonitoringSystemType) {
            folderMonitoringTypes = [site.folderMonitoringSystemType];
          }
          return {
            ...site,
            folderMonitoringTypes,
            lastUpdate: new Date(site.lastUpdate),
            healthHistory: site.healthHistory?.map((h: any) => ({
              ...h,
              timestamp: new Date(h.timestamp)
            })) || [],
            acknowledgedAlerts: site.acknowledgedAlerts || [],
            lastAcknowledgment: site.lastAcknowledgment ? new Date(site.lastAcknowledgment) : null
          };
        });
      } catch (error) {
        console.error('Error parsing saved sites:', error);
      }
    }
    
    return [];
  }, []);

  // Save sites to localStorage
  const saveSites = useCallback((sitesToSave: Site[]) => {
    localStorage.setItem('managedSites', JSON.stringify(sitesToSave));
  }, []);

  // Handle real log entries from file system monitoring (Electron IPC sends new-log-entry)
  const handleRealLogEntry = useCallback((logEntry: LogEntry) => {
    setLogs(prev => {
      const entry = {
        ...logEntry,
        timestamp: logEntry.timestamp instanceof Date ? logEntry.timestamp : new Date(logEntry.timestamp),
        fileInfo: logEntry.fileInfo ? {
          ...logEntry.fileInfo,
          lastModified: logEntry.fileInfo.lastModified instanceof Date ? logEntry.fileInfo.lastModified : new Date(logEntry.fileInfo.lastModified)
        } : { fileName: '', filePath: '', lineNumber: 0, fileSize: 0, lastModified: new Date() }
      };
      return [...prev.slice(-999), entry];
    });
    setTotalLogsProcessed(p => p + 1);
    // Forward logs via SNMP trap when severity matches config (critical, high, medium, low)
    if (logEntry.level) {
      forwardTrap('log', logEntry.level, {
        message: logEntry.message,
        source: logEntry.source,
        siteName: logEntry.siteName,
        errorCode: logEntry.errorCode
      }).catch(() => {});
    }
  }, []);

  // Listen for new log entries: Electron IPC (desktop) or WebSocket (browser)
  useEffect(() => {
    const isElectron = typeof (window as unknown as { require?: (m: string) => unknown }).require === 'function';
    if (isElectron) {
      try {
        const ipcRenderer = (window as unknown as { require: (m: string) => { ipcRenderer: { on: (ch: string, fn: (e: unknown, data: unknown) => void) => void; removeListener: (ch: string, fn: (e: unknown, data: unknown) => void) => void } } }).require('electron')?.ipcRenderer;
        if (!ipcRenderer) return;
        const onLog = (_e: unknown, logEntry: unknown) => handleRealLogEntry(logEntry as LogEntry);
        ipcRenderer.on('new-log-entry', onLog);
        return () => ipcRenderer.removeListener('new-log-entry', onLog);
      } catch {
        return;
      }
    }

    // Browser: connect to WebSocket for monitoring logs
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws-monitoring`;
    let ws: WebSocket | null = null;

    const sendConfig = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const sites = loadSites();
      ws.send(JSON.stringify({ type: 'monitoring-config', sites }));
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'new-log-entry' && msg.data) {
            handleRealLogEntry(msg.data as LogEntry);
          } else if (msg.type === 'new-anomaly' && msg.data) {
            setAnomalies((prev) => {
              const a = { ...msg.data, timestamp: new Date(msg.data.timestamp) };
              return [a, ...prev].slice(0, 50);
            });
          } else if (msg.type === 'predictions' && msg.data) {
            setServerPredictions(msg.data as ServerPredictionsPayload);
          } else if (msg.type === 'llm-evaluation-result' && msg.data) {
            setLlmEvaluationResult(msg.data);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onopen = sendConfig;
    } catch (e) {
      console.warn('WebSocket monitoring connection failed:', e);
    }

    const onConfigUpdate = () => sendConfig();
    window.addEventListener('monitoring-config-update', onConfigUpdate);
    return () => {
      window.removeEventListener('monitoring-config-update', onConfigUpdate);
      ws?.close();
    };
  }, [handleRealLogEntry, loadSites]);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      const loadedSites = loadSites();
      
      // Sites to monitor: folder path (custom or from Verint/BT config) or BT System
      const monitoredSites = loadedSites.filter(site => {
        if (site.btSystemEnabled) return true; // BT System sites tracked separately
        const hasCustomPath = site.monitoringConfig?.folderPath && 
          site.monitoringConfig.folderPath.trim() !== '' &&
          !site.monitoringConfig.folderPath.includes('example') &&
          !site.monitoringConfig.folderPath.includes('demo');
        const hasFolderMonitoring = site.folderMonitoringEnabled && site.folderMonitoringTypes?.length;
        return hasCustomPath || hasFolderMonitoring;
      });

      console.log(`Found ${monitoredSites.length} sites with valid monitoring configuration`);

      for (const site of monitoredSites) {
        try {
          await fileSystemMonitor.startMonitoring(site, handleRealLogEntry);
          console.log(`Registered monitoring for ${site.name} (recursive, tail)`);
        } catch (error) {
          console.error(`Failed to register monitoring for site ${site.name}:`, error);
        }
      }

      const initialMetrics = generateSystemMetrics(loadedSites, 0);

      setSites(loadedSites);
      setLogs([]);
      setAnomalies([]);
      setTotalLogsProcessed(0);
      setMetrics({
        ...initialMetrics,
        activeSites: loadedSites.filter(s => s.status !== 'red').length
      });
      setIsLoading(false);
    };

    initializeData();
  }, [loadSites, handleRealLogEntry]);

  // Client-side ML for Electron mode (no server) - run periodically when we have logs
  const isElectron = typeof (window as unknown as { require?: (m: string) => unknown }).require === 'function';
  useEffect(() => {
    if (!isElectron || logs.length < 5) return;
    const interval = setInterval(() => {
      const detected = mlDetector.detectAnomalies(logs);
      if (detected.length > 0) {
        setAnomalies((prev) => {
          const newOnes = detected.map((a) => ({ ...a, timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp) }));
          const combined = [...newOnes, ...prev.filter((p) => !newOnes.some((n) => n.id === p.id))];
          return combined.slice(0, 50);
        });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isElectron, logs, mlDetector]);

  // Update site health scores and history periodically from real logs
  useEffect(() => {
    const interval = setInterval(() => {
      setSites(prevSites => {
        const updatedSites = prevSites.map(site => {
          const hasCustomPath = site.monitoringConfig?.folderPath &&
            site.monitoringConfig.folderPath.trim() !== '' &&
            !site.monitoringConfig.folderPath.includes('example') &&
            !site.monitoringConfig.folderPath.includes('demo');
          const hasFolderMonitoring = site.folderMonitoringEnabled && site.folderMonitoringTypes?.length;
          const isMonitored = hasCustomPath || hasFolderMonitoring || site.btSystemEnabled;

          let healthScore = site.healthScore;
          let healthHistory = site.healthHistory ?? [];
          let status = site.status;

          if (isMonitored && logs.length > 0) {
            healthScore = HealthCalculator.calculateHealthScore(site, logs);
            healthHistory = HealthCalculator.updateHealthHistory(site, healthScore, logs);
            status = HealthCalculator.calculateSiteStatus({ ...site, healthScore, alertCounts: site.alertCounts });
          } else if (isMonitored) {
            healthScore = 100;
            status = 'green' as const;
          }

          return {
            ...site,
            healthScore,
            healthHistory,
            status,
            lastUpdate: new Date()
          };
        });

        saveSites(updatedSites);
        return updatedSites;
      });

      // Update system metrics
      setMetrics(prevMetrics => {
        const newTotalLogs = totalLogsProcessed;
        return generateSystemMetrics(sites, newTotalLogs, anomalies.length);
      });

    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [sites, logs, anomalies.length, totalLogsProcessed, saveSites]);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      const currentSites = loadSites();
      const newMetrics = generateSystemMetrics(currentSites, totalLogsProcessed, 0);
      setSites(currentSites);
      setMetrics({
        ...newMetrics,
        activeSites: currentSites.filter(s => s.status !== 'red').length
      });
      setIsRefreshing(false);
    }, 500);
  }, [loadSites, totalLogsProcessed]);

  const updateSites = useCallback(async (newSites: Site[]) => {
    // Stop monitoring for removed sites
    const removedSites = sites.filter(oldSite => 
      !newSites.find(newSite => newSite.id === oldSite.id)
    );
    
    for (const removedSite of removedSites) {
      await fileSystemMonitor.stopMonitoring(removedSite.id);
      console.log(`Stopped monitoring for removed site: ${removedSite.name}`);
    }

    const addedSites = newSites.filter(newSite => {
      const isNew = !sites.find(s => s.id === newSite.id);
      const hasCustomPath = newSite.monitoringConfig?.folderPath &&
        newSite.monitoringConfig.folderPath.trim() !== '' &&
        !newSite.monitoringConfig.folderPath.includes('example') &&
        !newSite.monitoringConfig.folderPath.includes('demo');
      const hasFolderMonitoring = newSite.folderMonitoringEnabled && newSite.folderMonitoringTypes?.length;
      return isNew && (hasCustomPath || hasFolderMonitoring);
    });

    for (const addedSite of addedSites) {
      try {
        await fileSystemMonitor.startMonitoring(addedSite, handleRealLogEntry);
        console.log(`Registered monitoring for new site: ${addedSite.name} (no simulation)`);
      } catch (error) {
        console.error(`Failed to register monitoring for site ${addedSite.name}:`, error);
      }
    }

    // Check for sites with updated monitoring configuration
    const updatedSites = newSites.filter(newSite => {
      const oldSite = sites.find(s => s.id === newSite.id);
      if (!oldSite) return false;
      return oldSite.monitoringConfig?.folderPath !== newSite.monitoringConfig?.folderPath ||
        oldSite.folderMonitoringEnabled !== newSite.folderMonitoringEnabled ||
        JSON.stringify(oldSite.folderMonitoringTypes?.sort()) !== JSON.stringify(newSite.folderMonitoringTypes?.sort());
    });

    for (const updatedSite of updatedSites) {
      await fileSystemMonitor.stopMonitoring(updatedSite.id);
      
      // Start new monitoring if has path or folder monitoring
      const hasPath = updatedSite.monitoringConfig?.folderPath &&
        updatedSite.monitoringConfig.folderPath.trim() !== '' &&
        !updatedSite.monitoringConfig.folderPath.includes('example') &&
        !updatedSite.monitoringConfig.folderPath.includes('demo');
      const hasFolderMon = updatedSite.folderMonitoringEnabled && updatedSite.folderMonitoringTypes?.length;
      if (hasPath || hasFolderMon) {
        try {
          await fileSystemMonitor.startMonitoring(updatedSite, handleRealLogEntry);
          console.log(`Updated monitoring registration for site: ${updatedSite.name} (no simulation)`);
        } catch (error) {
          console.error(`Failed to update monitoring for site ${updatedSite.name}:`, error);
        }
      }
    }

    setSites(newSites);
    saveSites(newSites);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('monitoring-config-update'));
    }
    
    setMetrics(prevMetrics => {
      const currentTotalLogs = prevMetrics?.totalLogs || 0;
      return generateSystemMetrics(newSites, currentTotalLogs, anomalies.length, logs);
    });

    const monitoredSites = newSites.filter(site => {
      const hasPath = site.monitoringConfig?.folderPath && 
        site.monitoringConfig.folderPath.trim() !== '' &&
        !site.monitoringConfig.folderPath.includes('example') &&
        !site.monitoringConfig.folderPath.includes('demo');
      const hasFolderMon = site.folderMonitoringEnabled && site.folderMonitoringTypes?.length;
      return hasPath || hasFolderMon || site.btSystemEnabled;
    });
    
    console.log(`Now tracking ${monitoredSites.length} sites with valid paths (no simulation)`);
    
    // Clear logs and anomalies since we're not simulating
    setLogs([]);
    setAnomalies([]);
    setTotalLogsProcessed(0);
  }, [sites, saveSites, handleRealLogEntry]);

  const acknowledgeLog = useCallback((logId: string, acknowledgedBy: string) => {
    setLogs(prevLogs => 
      prevLogs.map(log => 
        log.id === logId 
          ? { 
              ...log, 
              acknowledged: true, 
              acknowledgedBy, 
              acknowledgedAt: new Date() 
            }
          : log
      )
    );
  }, []);

  const acknowledgeAnomaly = useCallback((anomalyId: string, acknowledgedBy: string) => {
    setAnomalies(prevAnomalies => 
      prevAnomalies.map(anomaly => 
        anomaly.id === anomalyId 
          ? { 
              ...anomaly, 
              acknowledged: true, 
              acknowledgedBy, 
              acknowledgedAt: new Date() 
            }
          : anomaly
      )
    );
  }, []);

  const acknowledgeAllForSite = useCallback((siteId: string, acknowledgedBy: string) => {
    const now = new Date();
    
    setLogs(prevLogs => 
      prevLogs.map(log => 
        log.siteId === siteId && !log.acknowledged && ['critical', 'high'].includes(log.level)
          ? { 
              ...log, 
              acknowledged: true, 
              acknowledgedBy, 
              acknowledgedAt: now 
            }
          : log
      )
    );

    setAnomalies(prevAnomalies => 
      prevAnomalies.map(anomaly => 
        anomaly.siteId === siteId && !anomaly.acknowledged && ['critical', 'high'].includes(anomaly.severity)
          ? { 
              ...anomaly, 
              acknowledged: true, 
              acknowledgedBy, 
              acknowledgedAt: now 
            }
          : anomaly
      )
    );

    setSites(prevSites => {
      const updatedSites = prevSites.map(site => {
        if (site.id === siteId) {
          const canReset = HealthCalculator.canResetToGreen(site, logs);
          return {
            ...site,
            lastAcknowledgment: now,
            status: canReset ? 'green' : site.status
          };
        }
        return site;
      });
      saveSites(updatedSites);
      return updatedSites;
    });
  }, [logs, saveSites]);

  const enrichedLogs = useMemo(() => enrichLogData(logs), [logs]);

  return {
    sites,
    logs: enrichedLogs,
    anomalies,
    serverPredictions,
    llmEvaluationResult,
    metrics,
    isLoading,
    isRefreshing,
    refreshData,
    updateSites,
    acknowledgeLog,
    acknowledgeAnomaly,
    acknowledgeAllForSite
  };
}