import React, { useState, useCallback, useEffect } from 'react';
import { LogEntry } from '../types';
import { 
  Terminal, 
  Filter, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  XCircle,
  Clock,
  MapPin,
  User,
  FileText,
  Folder,
  Check,
  Bookmark
} from 'lucide-react';
import { format } from 'date-fns';
import { ViewLogFileButton } from './ViewLogFileButton';

const WATERMARK_STORAGE_KEY = 'logReviewWatermark';

function loadWatermark(scope: string): number | null {
  try {
    const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, number>;
    return data[scope] ?? null;
  } catch {
    return null;
  }
}

function saveWatermark(scope: string, timestamp: number) {
  try {
    const raw = localStorage.getItem(WATERMARK_STORAGE_KEY) || '{}';
    const data = JSON.parse(raw) as Record<string, number>;
    data[scope] = timestamp;
    localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

interface LogStreamProps {
  logs: LogEntry[];
  selectedSite: string | null;
  onAcknowledgeLog?: (logId: string, acknowledgedBy: string) => void;
  /** When logged in, use for acknowledgments instead of prompt */
  currentUser?: { fullName?: string; username: string } | null;
}

export function LogStream({ logs, selectedSite, onAcknowledgeLog, currentUser }: LogStreamProps) {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const watermarkScope = filterSite === 'all' ? '_all' : filterSite;
  const [watermark, setWatermarkState] = useState<number | null>(() => loadWatermark(watermarkScope));

  useEffect(() => {
    setWatermarkState(loadWatermark(watermarkScope));
  }, [watermarkScope]);

  const setWatermark = useCallback((ts: number) => {
    setWatermarkState(ts);
    saveWatermark(watermarkScope, ts);
  }, [watermarkScope]);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-400" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-400" />;
      default:
        return <Info className="h-4 w-4 text-slate-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'border-red-500 bg-red-500/10';
      case 'high':
        return 'border-orange-500 bg-orange-500/10';
      case 'medium':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'low':
        return 'border-blue-500 bg-blue-500/10';
      default:
        return 'border-slate-600 bg-slate-800';
    }
  };

  const filteredLogs = logs
    .filter(log => {
      const levelMatch = filterLevel === 'all' || log.level === filterLevel;
      const siteMatch = filterSite === 'all' || log.siteId === filterSite;
      const selectedSiteMatch = !selectedSite || log.siteId === selectedSite;
      return levelMatch && siteMatch && selectedSiteMatch;
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

  // Get unique sites for dropdown (fix duplicate issue)
  const uniqueSites = Array.from(
    new Map(logs.map(log => [log.siteId, { id: log.siteId, name: log.siteName }])).values()
  );

  const handleAcknowledge = (logId: string) => {
    const name = currentUser ? (currentUser.fullName || currentUser.username) : prompt('Enter your name/ID:');
    if (name && onAcknowledgeLog) {
      onAcknowledgeLog(logId, String(name).trim());
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Terminal className="h-5 w-5 text-green-400 mr-2" />
            Live Log Stream
            <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
              LIVE
            </span>
          </h3>
          <div className="text-sm text-slate-400 flex items-center gap-3">
            {filteredLogs.length} entries
            {watermark && (
              <span className="text-cyan-400 text-xs flex items-center gap-1">
                <Bookmark className="h-3 w-3" />
                Reviewed up to {format(new Date(watermark), 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-2 py-1"
          >
            <option value="all">All Sites</option>
            {uniqueSites.map(site => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No logs match the current filters</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredLogs.map((log, idx) => {
              const ts = log.timestamp.getTime();
              const isReviewed = watermark != null && ts >= watermark;
              const showSeparator = isReviewed && idx < filteredLogs.length - 1 && watermark != null && filteredLogs[idx + 1].timestamp.getTime() < watermark;
              return (
              <React.Fragment key={log.id}>
              <div
                className={`border-l-4 ${getLevelColor(log.level)} p-3 rounded-r-lg hover:bg-slate-750 transition-colors duration-150 ${
                  log.acknowledged ? 'opacity-60' : ''
                } ${isReviewed ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 text-sm text-slate-300 mb-1">
                        <Clock className="h-3 w-3" />
                        <span>{format(log.timestamp, 'HH:mm:ss')}</span>
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{log.siteName}</span>
                        <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">
                          {log.source}
                        </span>
                        {log.acknowledged && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs flex items-center space-x-1">
                            <Check className="h-3 w-3" />
                            <span>ACK</span>
                          </span>
                        )}
                      </div>
                      
                      <p className="text-white text-sm font-medium mb-2">
                        {log.message}
                      </p>
                      
                      {/* File Information */}
                      {log.fileInfo && (
                        <div className="flex items-center space-x-4 text-xs text-slate-400 mb-2">
                          <span className="flex items-center space-x-1">
                            <FileText className="h-3 w-3" />
                            <span>{log.fileInfo.fileName}</span>
                          </span>
                          <span>Line: {log.fileInfo.lineNumber}</span>
                          <span>{(log.fileInfo.fileSize / 1024).toFixed(1)}KB</span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        {log.ip && (
                          <span>IP: {log.ip}</span>
                        )}
                        {log.errorCode && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                            {log.errorCode}
                          </span>
                        )}
                        {log.userId && (
                          <span className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{log.userId}</span>
                          </span>
                        )}
                      </div>
                      
                      {/* File Path + View log file */}
                      {log.fileInfo?.filePath && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="text-xs text-slate-500 flex items-center space-x-1 flex-1 min-w-0">
                            <Folder className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{log.fileInfo.filePath}</span>
                          </div>
                          <ViewLogFileButton filePath={log.fileInfo.filePath} fileName={log.fileInfo.fileName} />
                        </div>
                      )}
                      
                      {/* Acknowledgment Info */}
                      {log.acknowledged && log.acknowledgedBy && log.acknowledgedAt && (
                        <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300">
                          Acknowledged by {log.acknowledgedBy} at {format(log.acknowledgedAt, 'MMM dd, HH:mm')}
                        </div>
                      )}
                      
                      {log.enrichedData?.resolution && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                          Resolution: {log.enrichedData.resolution}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWatermark(ts)}
                      className="flex items-center gap-1 px-2 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-xs transition-colors"
                      title="Mark reviewed up to here"
                    >
                      <Bookmark className="h-3 w-3" />
                      <span>Mark reviewed</span>
                    </button>
                    {!log.acknowledged && ['critical', 'high'].includes(log.level) && onAcknowledgeLog && (
                      <button
                        onClick={() => handleAcknowledge(log.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        <span>ACK</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
                {showSeparator && (
                  <div className="flex items-center gap-2 py-2 text-cyan-400/80 text-xs font-medium">
                    <div className="flex-1 h-px bg-cyan-500/30" />
                    <Bookmark className="h-3 w-3" />
                    <span>Reviewed up to here</span>
                    <div className="flex-1 h-px bg-cyan-500/30" />
                  </div>
                )}
            </React.Fragment>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}