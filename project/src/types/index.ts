/** BT System WebSocket commands (e.g. get_health, get_status, get_tpos, get_zones) */
export type BTSystemCommand = 'get_health' | 'get_status' | 'get_tpos' | 'get_zones' | 'ping' | 'subscribe';

export interface BTSystemConfig {
  url: string;
  token: string;
  commands: BTSystemCommand[];
  frequencySeconds: number;
}

/** Per-site TradeSense WBA API configuration - all commands from WBA 10.0.14 */
export interface TradeSenseConfig {
  url: string;
  token: string;
  /** Auto-fetch on connect */
  autoGetZones?: boolean;
  autoGetTurrets?: boolean;
  autoGetUsers?: boolean;
  autoGetEvents?: boolean;
  autoGetCalls?: boolean;
  autoGetVersion?: boolean;
  autoGetTpos?: boolean;
  autoGetLines?: boolean;
  autoGetHealth?: boolean;  // get_health (provisioning status)
  autoGetHealthApiReport?: boolean;  // get_health_api_report
  autoSubscribeToEvents?: boolean;
  /** Auto-reconnect when connection closes (default: true) */
  autoReconnect?: boolean;
}

export interface Site {
  id: string;
  name: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  healthScore: number;
  status: 'green' | 'amber' | 'red';
  alertCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate: Date;
  // Integration toggles
  btSystemEnabled?: boolean;
  btSystemConfig?: BTSystemConfig;
  tradeSenseEnabled?: boolean;
  tradeSenseConfig?: TradeSenseConfig;
  folderMonitoringEnabled?: boolean;
  /** When folder monitoring enabled: which systems to monitor. Site can monitor Verint, BT, or both. */
  folderMonitoringTypes?: ('bt' | 'verint')[];
  /** Per-site folder paths for BT and Verint. One path per selected type. */
  folderMonitoringPaths?: { bt?: string; verint?: string };
  // Enhanced monitoring configuration (folder path used when folderMonitoringSystemType not set)
  monitoringConfig: {
    folderPath: string;
    recursive: boolean;
    filePatterns: string[];
    excludePatterns: string[];
    tailEnabled: boolean;
    maxFileSize: number; // MB
    rotationHandling: boolean;
  };
  // Health tracking over 24 hours
  healthHistory: HealthDataPoint[];
  acknowledgedAlerts: string[]; // IDs of acknowledged alerts
  lastAcknowledgment: Date | null;
}

export interface HealthDataPoint {
  timestamp: Date;
  score: number;
  errorCount: number;
  logCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  siteId: string;
  siteName: string;
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  source: string;
  ip?: string;
  mac?: string;
  errorCode?: string;
  /** When from folder monitoring: 'bt' uses BT error codes, 'verint' uses Verint error codes */
  folderType?: 'bt' | 'verint';
  userId?: string;
  // Enhanced file tracking
  fileInfo: {
    fileName: string;
    filePath: string;
    lineNumber: number;
    fileSize: number;
    lastModified: Date;
  };
  enrichedData?: {
    location?: string;
    deviceName?: string;
    resolution?: string;
  };
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface MLAnomaly {
  id: string;
  timestamp: Date;
  siteId: string;
  siteName: string;
  type: 'pattern' | 'behavior' | 'timeseries' | 'threshold' | 'clustering' | 'isolation_forest';
  score: number; // 0-100
  description: string;
  details: {
    baseline?: number;
    current?: number;
    pattern?: string;
    confidence?: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** AI-generated summary (when LLM enabled) */
  aiSummary?: string;
  /** AI-suggested remediation steps (when LLM enabled) */
  aiRemediation?: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface SystemMetrics {
  totalSites: number;
  activeSites: number;
  totalLogs: number;
  logsPerHour: number;
  anomaliesDetected: number;
  avgResponseTime: number;
  systemHealth: number;
  // Enhanced monitoring metrics
  monitoringStats: {
    filesMonitored: number;
    foldersWatched: number;
    tailProcesses: number;
    bytesProcessed: number;
    lastScanTime: Date;
  };
}

export interface ChartDataPoint {
  timestamp: Date;
  value: number;
  site?: string;
  type?: string;
}

export interface ErrorCode {
  id: string;
  code: string;
  description: string;
  resolution: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolve: boolean;
}

export interface Asset {
  id: string;
  macAddress: string;
  ipAddress: string;
  deviceName: string;
  location: string;
  deskNumber: string;
  assignedUser: string;
  siteId: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
}

export interface SystemComponent {
  id: string;
  ipAddress: string;
  deviceName: string;
  location: string;
  siteId: string;
  systemType: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: Date;
}

export interface CriticalityRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    errorCodes: string[];
    sources: string[];
    keywords: string[];
    ipRanges: string[];
    timeWindow: number; // seconds
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalationTime: number; // seconds
  autoResolve: boolean;
  notificationChannels: string[];
}

// New interfaces for monitoring
export interface FileWatcher {
  id: string;
  siteId: string;
  folderPath: string;
  isActive: boolean;
  lastScan: Date;
  filesCount: number;
  status: 'running' | 'stopped' | 'error';
}

export interface TailProcess {
  id: string;
  siteId: string;
  filePath: string;
  lastPosition: number;
  isActive: boolean;
  linesProcessed: number;
  status: 'tailing' | 'stopped' | 'error';
}

// Reporting interfaces
export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: 'health_trend' | 'error_analysis' | 'site_performance' | 'anomaly_summary' | 'alarm_types' | 'theme_analysis' | 'peak_hours' | 'source_analysis' | 'custom';
  dateRange: {
    start: Date;
    end: Date;
    preset?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | '24h' | '7d' | '30d' | '90d' | '6m' | 'custom';
  };
  filters: {
    siteIds: string[];
    severityLevels: string[];
    sources: string[];
    errorCodes: string[];
  };
  visualization: 'chart' | 'table' | 'both';
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
  createdAt: Date;
  lastRun?: Date;
}

export interface ReportData {
  id: string;
  configId: string;
  generatedAt: Date;
  dateRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalLogs: number;
    totalErrors: number;
    avgHealthScore: number;
    sitesAnalyzed: number;
    anomaliesDetected: number;
  };
  chartData: ChartDataPoint[];
  tableData: any[];
  insights: string[];
}

// 13 BT Systems WebSocket API - Health Report & Status
export interface BTSystemHealthReport {
  systemId: string;
  systemName: string;
  timestamp: Date;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'maintenance';
  components: {
    name: string;
    status: 'ok' | 'degraded' | 'failed' | 'unknown';
    value?: number;
    unit?: string;
    message?: string;
  }[];
  metrics?: Record<string, number>;
  lastReported?: Date;
}

export interface BTSystemStatus {
  systemId: string;
  systemName: string;
  timestamp: Date;
  online: boolean;
  latencyMs?: number;
  message?: string;
  version?: string;
}

export interface BTSystemsWebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
}