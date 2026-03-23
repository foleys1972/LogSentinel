import { LogEntry, Site } from '../types';

function getElectronIpc(): { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const req = (window as unknown as { require?: (m: string) => unknown }).require;
    if (typeof req === 'function') {
      const electron = req('electron') as { ipcRenderer: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } };
      return electron?.ipcRenderer || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export class FileSystemMonitor {
  private watchers: Map<string, any> = new Map();
  private tailProcesses: Map<string, any> = new Map();
  private activeWatcherKeys: Set<string> = new Set();
  
  // Track actual monitoring statistics
  private monitoringStats = {
    filesMonitored: 0,
    foldersWatched: 0,
    tailProcesses: 0,
    bytesProcessed: 0,
    lastScanTime: new Date(),
    siteStats: new Map<string, { files: number; folders: number; tailProcesses: number }>()
  };

  /**
   * Get folder path for a type from per-site config only. If blank, no monitoring.
   */
  private getFolderPathForType(site: Site, folderType: 'bt' | 'verint'): string {
    return (site.folderMonitoringPaths?.[folderType] ?? '').trim();
  }

  /**
   * Get effective folder paths for a site. Only includes paths that are non-blank.
   */
  private getEffectiveFolderPaths(site: Site): Array<{ path: string; folderType?: 'bt' | 'verint' }> {
    if (site.folderMonitoringEnabled && site.folderMonitoringTypes?.length) {
      return site.folderMonitoringTypes
        .map(folderType => ({ path: this.getFolderPathForType(site, folderType), folderType }))
        .filter(({ path }) => path);
    }
    const customPath = site.monitoringConfig?.folderPath || '';
    if (customPath) return [{ path: customPath }];
    return [];
  }

  /**
   * Start monitoring a site's configured folder path(s).
   * When site monitors both Verint and BT, starts separate watchers for each folder.
   * Uses recursive monitoring (child folders) and real-time tail of log files.
   */
  async startMonitoring(site: Site, onLogEntry: (log: LogEntry) => void): Promise<void> {
    const folderEntries = this.getEffectiveFolderPaths(site);
    if (!folderEntries.length) {
      console.warn(`No folder path configured for site ${site.name}`);
      return;
    }

    const ipc = getElectronIpc();

    try {
      for (const { path: folderPath, folderType } of folderEntries) {
        if (!this.isValidPath(folderPath)) continue;

        const watcherKey = folderType ? `${site.id}_${folderType}` : site.id;

        if (ipc) {
          try {
            const result = await ipc.invoke('start-monitoring', watcherKey, folderPath, {
              recursive: true,
              tailEnabled: true,
              filePatterns: ['*.log', '*.txt'],
              excludePatterns: ['**/*.tmp', '**/*.bak'],
              siteInfo: { siteId: site.id, siteName: site.name, folderType }
            }) as { success?: boolean; error?: string };
            if (result?.success) {
              this.activeWatcherKeys.add(watcherKey);
              console.log(`Started Electron monitoring for ${site.name}${folderType ? ` (${folderType})` : ''} at ${folderPath} (recursive, tail)`);
            } else {
              console.warn(`Electron start-monitoring failed: ${result?.error}`);
            }
          } catch (e) {
            console.error(`Failed to start Electron monitoring for ${watcherKey}:`, e);
          }
        } else {
          this.monitoringStats.siteStats.set(watcherKey, { files: 0, folders: 0, tailProcesses: 0 });
          console.log(`Monitoring configured for ${site.name}${folderType ? ` (${folderType})` : ''} at ${folderPath} (Electron not available)`);
        }
      }
      this.updateGlobalStats();
    } catch (error) {
      console.error(`Failed to start monitoring for site ${site.name}:`, error);
    }
  }

  /**
   * Update global monitoring statistics
   */
  private updateGlobalStats(): void {
    let totalFiles = 0;
    let totalFolders = 0;
    let totalTailProcesses = 0;
    
    this.monitoringStats.siteStats.forEach(stats => {
      totalFiles += stats.files;
      totalFolders += stats.folders;
      totalTailProcesses += stats.tailProcesses;
    });
    
    this.monitoringStats.filesMonitored = totalFiles;
    this.monitoringStats.foldersWatched = totalFolders;
    this.monitoringStats.tailProcesses = totalTailProcesses;
    this.monitoringStats.lastScanTime = new Date();
  }

  /**
   * Check if the path looks like a real monitoring path
   */
  private isValidPath(path: string): boolean {
    if (!path || path.trim() === '' || path.includes('example') || path.includes('demo')) {
      return false;
    }
    const normalized = path.replace(/\//g, '\\');
    const validPatterns = [
      /^\/var\/log/,           // Linux
      /^\/opt\/.*\/logs?/,     // Linux app logs
      /^\/home\/.*\/logs?/,    // Linux user logs
      /^[A-Za-z]:\\.*/,        // Windows (C:\, D:\, etc.)
      /^\/usr\/local\/.*\/logs?/,
    ];
    return validPatterns.some(p => p.test(path)) || /^[A-Za-z]:\\.+/.test(normalized) || /^\/[^/]+/.test(path);
  }

  /**
   * Stop monitoring a site (removes all watchers for this site, including Verint/BT variants)
   */
  async stopMonitoring(siteId: string): Promise<void> {
    const ipc = getElectronIpc();
    if (ipc) {
      try {
        await ipc.invoke('stop-monitoring', siteId);
      } catch (e) {
        console.error(`Failed to stop Electron monitoring for ${siteId}:`, e);
      }
    }
    [siteId, `${siteId}_verint`, `${siteId}_bt`].forEach(key => {
      this.activeWatcherKeys.delete(key);
      const watcher = this.watchers.get(key);
      if (watcher && typeof watcher?.close === 'function') {
        watcher.close();
      }
      this.watchers.delete(key);
      const tailKey = `${key}_simulated`;
      const tailProcess = this.tailProcesses.get(tailKey);
      if (tailProcess) {
        clearInterval(tailProcess);
      }
      this.tailProcesses.delete(tailKey);
      this.monitoringStats.siteStats.delete(key);
    });
    this.updateGlobalStats();
    console.log(`Stopped monitoring for site ${siteId}`);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    return {
      activeWatchers: this.watchers.size,
      activeTailProcesses: this.tailProcesses.size,
      monitoredFiles: Array.from(this.tailProcesses.keys()),
      stats: this.monitoringStats
    };
  }

  /**
   * Get current monitoring statistics for system metrics
   */
  getCurrentStats() {
    return {
      filesMonitored: this.monitoringStats.filesMonitored,
      foldersWatched: this.monitoringStats.foldersWatched,
      tailProcesses: this.monitoringStats.tailProcesses,
      bytesProcessed: this.monitoringStats.bytesProcessed,
      lastScanTime: this.monitoringStats.lastScanTime
    };
  }
}

// Singleton instance
export const fileSystemMonitor = new FileSystemMonitor();