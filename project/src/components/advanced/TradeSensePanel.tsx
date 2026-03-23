import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Activity,
  MapPin,
  Server,
  Heart,
  Bell,
  RefreshCw,
  Zap,
  FileText
} from 'lucide-react';
import { selectLogFile, appendToLogFile, type WsLogWriter } from '../../utils/wsLogToFile';
import { Site } from '../../types';
import { useTradeSenseWebSocket } from '../../hooks/useTradeSenseWebSocket';

interface TradeSensePanelProps {
  sites: Site[];
  onSitesUpdate?: (sites: Site[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

type TradeSenseAutoOptions = {
  autoGetZones?: boolean;
  autoGetTurrets?: boolean;
  autoGetUsers?: boolean;
  autoGetEvents?: boolean;
  autoGetCalls?: boolean;
  autoGetVersion?: boolean;
  autoGetTpos?: boolean;
  autoGetLines?: boolean;
  autoGetHealth?: boolean;
  autoGetHealthApiReport?: boolean;
  autoSubscribeToEvents?: boolean;
  autoReconnect?: boolean;
};

interface TradeSenseSiteCardProps {
  site: Site;
  options: TradeSenseAutoOptions;
  onAutoReconnectChange?: (siteId: string, value: boolean) => void;
  onMessage?: (rawMessage: string) => void;
}

function TradeSenseSiteCard({ site, options, onAutoReconnectChange, onMessage }: TradeSenseSiteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [subscribedCategories, setSubscribedCategories] = useState<Set<string>>(new Set());
  const cfg = site.tradeSenseConfig;
  const url = cfg?.url?.trim() || '';
  const token = cfg?.token?.trim() || '';
  const hasRunAutoRef = useRef(false);

  const {
    isConnected,
    isAuthenticated,
    zones,
    tpos,
    healthReport,
    notifications,
    lastError,
    connect,
    disconnect,
    getZones,
    getTpos,
    getHealthApiReport,
    runCommand,
    subscribe,
    unsubscribe,
    clearNotifications
  } = useTradeSenseWebSocket(url || null, token || null, {
    skipAutoConnect: true,
    autoReconnect: options.autoReconnect,
    onMessage
  });

  useEffect(() => {
    if (!isAuthenticated || !url || !token) {
      hasRunAutoRef.current = false;
      return;
    }
    if (hasRunAutoRef.current) return;
    hasRunAutoRef.current = true;
    (async () => {
      if (options.autoGetZones) await getZones();
      if (options.autoGetTpos) await getTpos();
      if (options.autoGetHealthApiReport) await getHealthApiReport(false);
      if (options.autoGetTurrets) await runCommand('get_turrets', {}).catch(() => {});
      if (options.autoGetUsers) await runCommand('get_users', {}).catch(() => {});
      if (options.autoGetEvents) await runCommand('get_events', {}).catch(() => {});
      if (options.autoGetCalls) await runCommand('get_calls', {}).catch(() => {});
      if (options.autoGetVersion) await runCommand('get_version', {}).catch(() => {});
      if (options.autoGetLines) await runCommand('get_lines', {}).catch(() => {});
      if (options.autoGetHealth) await runCommand('get_health', {}).catch(() => {});
      if (options.autoSubscribeToEvents) {
        for (const cat of ['calls', 'presences', 'alerts'] as const) {
          try {
            await subscribe(cat);
            setSubscribedCategories((prev) => new Set(prev).add(cat));
          } catch {
            /* ignore */
          }
        }
      }
    })();
  }, [isAuthenticated, url, token]);

  const handleConnect = useCallback(() => {
    if (url && token) connect(url, token);
  }, [connect, url, token]);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-400" />
          )}
          <span className="font-medium text-white">{site.name}</span>
          <span className="text-slate-400 text-sm">{site.location}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isAuthenticated
                ? 'text-green-400 bg-green-500/10'
                : isConnected
                  ? 'text-amber-400 bg-amber-500/10'
                  : 'text-slate-400 bg-slate-500/10'
            }`}
          >
            {isAuthenticated ? 'Authenticated' : isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              <WifiOff className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={!url || !token}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-sm"
            >
              <Wifi className="h-4 w-4" />
              Connect
            </button>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
            <input
              type="checkbox"
              checked={options.autoReconnect}
              onChange={(e) => onAutoReconnectChange?.(site.id, e.target.checked)}
              className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            Auto reconnect
          </label>
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-slate-700 space-y-4">
          {!url || !token ? (
            <p className="text-slate-400 text-sm">
              Configure TradeSense URL and token in Admin → Site Manager for this site.
            </p>
          ) : (
            <>
              {lastError && (
                <div className="text-red-400 text-sm flex items-center gap-1">
                  {lastError}
                </div>
              )}
              {isAuthenticated && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => getZones()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    <MapPin className="h-4 w-4" />
                    Get Zones
                  </button>
                  <button
                    onClick={() => getTpos()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    <Server className="h-4 w-4" />
                    Get TPOs
                  </button>
                  <button
                    onClick={() => getHealthApiReport(false)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                  >
                    <Heart className="h-4 w-4" />
                    Health Report
                  </button>
                  {['calls', 'presences', 'alerts'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        subscribedCategories.has(cat)
                          ? unsubscribe(cat as 'calls' | 'presences' | 'alerts').then(() =>
                              setSubscribedCategories((p) => {
                                const n = new Set(p);
                                n.delete(cat);
                                return n;
                              })
                            )
                          : subscribe(cat as 'calls' | 'presences' | 'alerts').then(() =>
                              setSubscribedCategories((p) => new Set(p).add(cat))
                            )
                      }
                      className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                        subscribedCategories.has(cat) ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-700'
                      } text-white`}
                    >
                      <Bell className="h-4 w-4" />
                      {subscribedCategories.has(cat) ? 'Unsub' : 'Sub'} {cat}
                    </button>
                  ))}
                  <button
                    onClick={clearNotifications}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    Zones ({zones.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
                    {zones.length === 0 ? (
                      <p className="text-slate-400">Click Get Zones</p>
                    ) : (
                      zones.map((z) => (
                        <div key={z.id} className="text-slate-300">
                          {z.name}
                          {z.locationCity && ` • ${z.locationCity}`}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Server className="h-4 w-4 text-cyan-400" />
                    TPOs ({tpos.length})
                  </h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-sm">
                    {tpos.length === 0 ? (
                      <p className="text-slate-400">Click Get TPOs</p>
                    ) : (
                      tpos.map((t, i) => (
                        <div key={i} className="text-slate-300">
                          {t.name} • {t.alive ? 'Alive' : 'Offline'}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-cyan-400" />
                    Health Report
                  </h4>
                  {healthReport ? (
                    <pre className="text-xs text-slate-300 overflow-x-auto max-h-40 overflow-y-auto">
                      {JSON.stringify(healthReport, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-slate-400 text-sm">Click Health Report</p>
                  )}
                </div>
                <div className="lg:col-span-2 bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-cyan-400" />
                    Notifications ({notifications.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-slate-400 text-sm">Subscribe to receive events</p>
                    ) : (
                      notifications.slice(-10).reverse().map((n, i) => (
                        <div key={i} className="text-sm">
                          <span className="text-cyan-400">{n.category}</span>
                          <pre className="text-xs text-slate-300 mt-1">
                            {JSON.stringify(n.events, null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const defaultOptions: TradeSenseAutoOptions = {
  autoGetZones: false,
  autoGetTurrets: false,
  autoGetUsers: false,
  autoGetEvents: false,
  autoGetCalls: false,
  autoGetVersion: false,
  autoGetTpos: false,
  autoGetLines: false,
  autoGetHealth: false,
  autoGetHealthApiReport: true,
  autoSubscribeToEvents: true,
  autoReconnect: true
};

const TRADESENSE_LOG_STORAGE_KEY = 'tradeSenseLogConfig';

export function TradeSensePanel({ sites, onSitesUpdate, isOpen, onClose }: TradeSensePanelProps) {
  const tradeSenseSites = sites.filter((s) => s.tradeSenseEnabled && s.tradeSenseConfig);
  const [logWriter, setLogWriter] = useState<WsLogWriter | null>(null);
  const [logFilePath, setLogFilePath] = useState<string>('');
  const [logToFileEnabled, setLogToFileEnabled] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TRADESENSE_LOG_STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.logFilePath) {
          setLogFilePath(config.logFilePath);
          setLogToFileEnabled(config.logToFileEnabled ?? false);
          if (config.logToFileEnabled) {
            setLogWriter({ type: 'electron', filePath: config.logFilePath });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSelectLogFile = useCallback(async () => {
    setLogError(null);
    const result = await selectLogFile();
    if (result.success) {
      if (result.filePath) {
        setLogWriter({ type: 'electron', filePath: result.filePath });
        setLogFilePath(result.filePath);
      } else if (result.fileHandle) {
        setLogWriter({ type: 'browser', fileHandle: result.fileHandle });
        setLogFilePath(result.fileHandle.name);
      }
      setLogToFileEnabled(true);
      try {
        const saved = JSON.parse(localStorage.getItem(TRADESENSE_LOG_STORAGE_KEY) || '{}');
        saved.logFilePath = result.filePath || result.fileHandle?.name;
        saved.logToFileEnabled = true;
        localStorage.setItem(TRADESENSE_LOG_STORAGE_KEY, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    } else if (result.error) {
      setLogError(result.error);
    }
  }, []);

  const onMessage = useCallback(
    async (rawMessage: string) => {
      if (!logToFileEnabled || !logWriter) return;
      try {
        const timestamp = new Date().toISOString();
        await appendToLogFile(logWriter, `[${timestamp}] ${rawMessage}`);
      } catch {
        /* ignore */
      }
    },
    [logToFileEnabled, logWriter]
  );

  const handleAutoReconnectChange = useCallback(
    (siteId: string, value: boolean) => {
      const updated = sites.map((s) =>
        s.id === siteId && s.tradeSenseConfig
          ? { ...s, tradeSenseConfig: { ...s.tradeSenseConfig, autoReconnect: value } }
          : s
      );
      onSitesUpdate?.(updated);
    },
    [sites, onSitesUpdate]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Zap className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">TradeSense WBA API</h2>
                <p className="text-slate-400">
                  Per-site configuration. Configure URL and token in Admin → Site Manager.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-600">
            <h5 className="text-white font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Log API output to file
            </h5>
            <p className="text-slate-400 text-xs mb-2">
              Write all received WebSocket messages (responses, notifications) to a file for debugging or audit.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSelectLogFile}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm"
              >
                Select file
              </button>
              {logFilePath && (
                <span className="text-slate-400 text-sm truncate max-w-[200px]" title={logFilePath}>
                  {logFilePath}
                </span>
              )}
              {logToFileEnabled && logFilePath && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={logToFileEnabled}
                    onChange={(e) => {
                      setLogToFileEnabled(e.target.checked);
                      if (!e.target.checked) setLogWriter(null);
                      try {
                        const saved = JSON.parse(localStorage.getItem(TRADESENSE_LOG_STORAGE_KEY) || '{}');
                        saved.logToFileEnabled = e.target.checked;
                        localStorage.setItem(TRADESENSE_LOG_STORAGE_KEY, JSON.stringify(saved));
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                  Enabled
                </label>
              )}
              {logError && <span className="text-red-400 text-sm">{logError}</span>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tradeSenseSites.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h4 className="text-white font-medium mb-2">No TradeSense sites configured</h4>
              <p className="text-slate-400 max-w-md mx-auto">
                Enable TradeSense WBA API for a site in Admin → Site Manager and add the WebSocket URL and API token.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tradeSenseSites.map((site) => {
                const cfg = site.tradeSenseConfig;
                const opts: TradeSenseAutoOptions = cfg ? {
                  autoGetZones: cfg.autoGetZones ?? defaultOptions.autoGetZones,
                  autoGetTurrets: cfg.autoGetTurrets ?? defaultOptions.autoGetTurrets,
                  autoGetUsers: cfg.autoGetUsers ?? defaultOptions.autoGetUsers,
                  autoGetEvents: cfg.autoGetEvents ?? defaultOptions.autoGetEvents,
                  autoGetCalls: cfg.autoGetCalls ?? defaultOptions.autoGetCalls,
                  autoGetVersion: cfg.autoGetVersion ?? defaultOptions.autoGetVersion,
                  autoGetTpos: cfg.autoGetTpos ?? defaultOptions.autoGetTpos,
                  autoGetLines: cfg.autoGetLines ?? defaultOptions.autoGetLines,
                  autoGetHealth: cfg.autoGetHealth ?? defaultOptions.autoGetHealth,
                  autoGetHealthApiReport: cfg.autoGetHealthApiReport ?? (cfg as { autoGetHealthApi?: boolean }).autoGetHealthApi ?? defaultOptions.autoGetHealthApiReport,
                  autoSubscribeToEvents: cfg.autoSubscribeToEvents ?? defaultOptions.autoSubscribeToEvents,
                  autoReconnect: cfg.autoReconnect ?? defaultOptions.autoReconnect
                } : defaultOptions;
                return (
                  <TradeSenseSiteCard
                    key={site.id}
                    site={site}
                    options={opts}
                    onAutoReconnectChange={handleAutoReconnectChange}
                    onMessage={logToFileEnabled && logWriter ? onMessage : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
