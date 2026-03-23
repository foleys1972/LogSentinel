import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Zap,
  FileText,
  ChevronDown,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { Site } from '../../types';
import { useBTSystemsWebSocket } from '../../hooks/useBTSystemsWebSocket';
import { selectLogFile, appendToLogFile, type WsLogWriter } from '../../utils/wsLogToFile';
import type { BTSystemHealthReport, BTSystemStatus } from '../../types';

const STORAGE_KEY = 'btSystemsWebSocketConfig';

interface BTSystemsPanelProps {
  sites?: Site[];
  isOpen: boolean;
  onClose: () => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
    case 'ok':
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    case 'warning':
    case 'degraded':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'critical':
    case 'failed':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'offline':
      return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    case 'maintenance':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    default:
      return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  }
}

interface BTSystemSiteCardProps {
  site: Site;
  onMessage?: (rawMessage: string) => void;
}

interface BTSystemStandaloneCardProps {
  onMessage?: (rawMessage: string) => void;
}

function BTSystemStandaloneCard({ onMessage }: BTSystemStandaloneCardProps) {
  const [url, setUrl] = useState('');
  const {
    isConnected,
    healthReports,
    systemStatuses,
    error,
    reconnectAttempts,
    connect,
    disconnect,
    clearReports,
    setUrl: persistUrl
  } = useBTSystemsWebSocket(null, { skipAutoConnect: true, onMessage });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.url) setUrl(config.url);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleConnect = useCallback(() => {
    const u = url.trim();
    if (u) {
      persistUrl(u);
      connect(u);
    }
  }, [url, connect, persistUrl]);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
      <div className="p-4 space-y-4">
        <h4 className="text-white font-medium">Standalone connection</h4>
        <p className="text-slate-400 text-sm">No sites configured. Enter a WebSocket URL to connect directly.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="wss://..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
          />
          {isConnected ? (
            <button onClick={() => disconnect()} className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
              <WifiOff className="h-4 w-4" />
              Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} disabled={!url.trim()} className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-sm">
              <Wifi className="h-4 w-4" />
              Connect
            </button>
          )}
        </div>
        {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertTriangle className="h-4 w-4" />{error}</div>}
        {reconnectAttempts > 0 && !isConnected && <span className="text-amber-400 text-sm">Reconnect attempt {reconnectAttempts}</span>}
        <button onClick={clearReports} className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"><Trash2 className="h-4 w-4" />Clear data</button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded p-3">
            <h5 className="text-white font-medium mb-2 flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-400" />Health Reports ({healthReports.length})</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {healthReports.length === 0 ? <p className="text-slate-400">Connect to receive health data.</p> : healthReports.map((r: BTSystemHealthReport) => (
                <div key={`${r.systemId}-${r.timestamp.getTime()}`} className="bg-slate-900 p-2 rounded">
                  <div className="flex justify-between"><span className="text-white">{r.systemName}</span><span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(r.status)}`}>{r.status}</span></div>
                  <div className="text-slate-400 text-xs">Score: {r.healthScore}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <h5 className="text-white font-medium mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />System Status ({systemStatuses.length})</h5>
            <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {systemStatuses.length === 0 ? <p className="text-slate-400">Connect to receive status.</p> : systemStatuses.map((s: BTSystemStatus) => (
                <div key={`${s.systemId}-${s.timestamp.getTime()}`} className="flex justify-between items-center bg-slate-900 p-2 rounded">
                  <span className="text-white">{s.systemName}</span>
                  {s.online ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BTSystemSiteCard({ site, onMessage }: BTSystemSiteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = site.btSystemConfig;
  const url = cfg?.url?.trim() || '';

  const {
    isConnected,
    healthReports,
    systemStatuses,
    error,
    reconnectAttempts,
    connect,
    disconnect,
    clearReports
  } = useBTSystemsWebSocket(url || null, {
    skipAutoConnect: true,
    onMessage
  });

  const handleConnect = useCallback(() => {
    if (url) connect(url);
  }, [connect, url]);

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
              isConnected ? 'text-green-400 bg-green-500/10' : 'text-slate-400 bg-slate-500/10'
            }`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
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
              disabled={!url}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-sm"
            >
              <Wifi className="h-4 w-4" />
              Connect
            </button>
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-slate-700 space-y-4">
          {!url ? (
            <p className="text-slate-400 text-sm">
              Configure BT System WebSocket URL in Admin → Site Manager for this site.
            </p>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {reconnectAttempts > 0 && !isConnected && (
                <span className="text-amber-400 text-sm">Reconnect attempt {reconnectAttempts}</span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={clearReports}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear data
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Health Reports ({healthReports.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                    {healthReports.length === 0 ? (
                      <p className="text-slate-400">Connect to receive health data.</p>
                    ) : (
                      healthReports.map((r: BTSystemHealthReport) => (
                        <div key={`${r.systemId}-${r.timestamp.getTime()}`} className="bg-slate-900 p-2 rounded">
                          <div className="flex justify-between">
                            <span className="text-white">{r.systemName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(r.status)}`}>{r.status}</span>
                          </div>
                          <div className="text-slate-400 text-xs">Score: {r.healthScore}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="bg-slate-800 rounded p-3">
                  <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    System Status ({systemStatuses.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                    {systemStatuses.length === 0 ? (
                      <p className="text-slate-400">Connect to receive status.</p>
                    ) : (
                      systemStatuses.map((s: BTSystemStatus) => (
                        <div key={`${s.systemId}-${s.timestamp.getTime()}`} className="flex justify-between items-center bg-slate-900 p-2 rounded">
                          <span className="text-white">{s.systemName}</span>
                          {s.online ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
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

export function BTSystemsPanel({ sites = [], isOpen, onClose }: BTSystemsPanelProps) {
  const btSites = sites.filter((s) => s.btSystemEnabled && s.btSystemConfig?.url?.trim());
  const [logWriter, setLogWriter] = useState<WsLogWriter | null>(null);
  const [logFilePath, setLogFilePath] = useState<string>('');
  const [logToFileEnabled, setLogToFileEnabled] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const logWriterRef = useRef<WsLogWriter | null>(null);
  logWriterRef.current = logWriter;

  const onMessage = useCallback((raw: string) => {
    const writer = logWriterRef.current;
    if (!writer) return;
    appendToLogFile(writer, raw).then((r) => {
      if (!r.success) setLogError(r.error || 'Write failed');
    });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        setLogToFileEnabled(config.logToFileEnabled ?? false);
        if (config.logFilePath) {
          setLogFilePath(config.logFilePath);
          setLogWriter({ type: 'electron', filePath: config.logFilePath });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSelectLogFile = useCallback(async () => {
    setLogError(null);
    const result = await selectLogFile();
    if (result.success && result.filePath) {
      setLogWriter({ type: 'electron', filePath: result.filePath });
      setLogFilePath(result.filePath);
      setLogToFileEnabled(true);
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        saved.logFilePath = result.filePath;
        saved.logToFileEnabled = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    } else if (result.error) {
      setLogError(result.error);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Zap className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">13 BT Systems - WebSocket API</h2>
                <p className="text-slate-400">Per-site Connect/Disconnect. Configure URL in Admin → Site Manager.</p>
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
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSelectLogFile}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm"
              >
                Select file
              </button>
              {logFilePath && <span className="text-slate-400 text-sm truncate max-w-[200px]" title={logFilePath}>{logFilePath}</span>}
              {logToFileEnabled && logFilePath && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={logToFileEnabled} onChange={(e) => setLogToFileEnabled(e.target.checked)} className="rounded bg-slate-800 border-slate-600" />
                  Enabled
                </label>
              )}
              {logError && <span className="text-red-400 text-sm">{logError}</span>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {btSites.length === 0 ? (
            <BTSystemStandaloneCard
              onMessage={logToFileEnabled && logWriter ? onMessage : undefined}
            />
          ) : (
            <div className="space-y-3">
              {btSites.map((site) => (
                <BTSystemSiteCard
                  key={site.id}
                  site={site}
                  onMessage={logToFileEnabled && logWriter ? onMessage : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
