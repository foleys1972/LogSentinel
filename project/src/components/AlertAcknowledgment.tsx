import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import { LogEntry, MLAnomaly } from '../types';
import { format } from 'date-fns';
import { ViewLogFileButton } from './ViewLogFileButton';

interface AlertAcknowledgmentProps {
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  onAcknowledgeLog: (logId: string, acknowledgedBy: string) => void;
  onAcknowledgeAnomaly: (anomalyId: string, acknowledgedBy: string) => void;
  onAcknowledgeAll: (siteId: string, acknowledgedBy: string) => void;
  selectedSite?: string | null;
  /** When logged in, pre-fill and use for acknowledgments */
  currentUser?: { fullName?: string; username: string } | null;
}

export function AlertAcknowledgment({ 
  logs, 
  anomalies, 
  onAcknowledgeLog, 
  onAcknowledgeAnomaly, 
  onAcknowledgeAll,
  selectedSite,
  currentUser
}: AlertAcknowledgmentProps) {
  const defaultAck = currentUser ? (currentUser.fullName || currentUser.username) : '';
  const [acknowledgedBy, setAcknowledgedBy] = useState(defaultAck);
  const [showAcknowledgmentPanel, setShowAcknowledgmentPanel] = useState(false);

  // Filter unacknowledged critical and high severity items
  const unacknowledgedLogs = logs.filter(log => 
    !log.acknowledged && 
    ['critical', 'high'].includes(log.level) &&
    (!selectedSite || log.siteId === selectedSite)
  );

  const unacknowledgedAnomalies = anomalies.filter(anomaly => 
    !anomaly.acknowledged && 
    ['critical', 'high'].includes(anomaly.severity) &&
    (!selectedSite || anomaly.siteId === selectedSite)
  );

  const totalUnacknowledged = unacknowledgedLogs.length + unacknowledgedAnomalies.length;

  const handleAcknowledgeLog = (logId: string) => {
    if (!acknowledgedBy.trim()) {
      alert('Please enter your name/ID before acknowledging alerts');
      return;
    }
    onAcknowledgeLog(logId, acknowledgedBy.trim());
  };

  const handleAcknowledgeAnomaly = (anomalyId: string) => {
    if (!acknowledgedBy.trim()) {
      alert('Please enter your name/ID before acknowledging alerts');
      return;
    }
    onAcknowledgeAnomaly(anomalyId, acknowledgedBy.trim());
  };

  const handleAcknowledgeAll = () => {
    if (!acknowledgedBy.trim()) {
      alert('Please enter your name/ID before acknowledging alerts');
      return;
    }
    
    if (selectedSite) {
      onAcknowledgeAll(selectedSite, acknowledgedBy.trim());
    } else {
      // Acknowledge all for all sites
      const siteIds = [...new Set([...unacknowledgedLogs.map(l => l.siteId), ...unacknowledgedAnomalies.map(a => a.siteId)])];
      siteIds.forEach(siteId => onAcknowledgeAll(siteId, acknowledgedBy.trim()));
    }
  };

  useEffect(() => {
    setAcknowledgedBy(currentUser ? (currentUser.fullName || currentUser.username) : '');
  }, [currentUser?.username, currentUser?.fullName]);

  useEffect(() => {
    const handler = () => setShowAcknowledgmentPanel(true);
    window.addEventListener('open-alert-panel', handler);
    return () => window.removeEventListener('open-alert-panel', handler);
  }, []);

  if (totalUnacknowledged === 0) {
    return null;
  }

  return (
    <>
      {/* Alert Badge */}
      <button
        onClick={() => setShowAcknowledgmentPanel(true)}
        className="fixed bottom-6 left-6 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-110 z-40 flex items-center space-x-2"
      >
        <AlertTriangle className="h-6 w-6" />
        <span className="bg-white text-red-600 px-2 py-1 rounded-full text-sm font-bold">
          {totalUnacknowledged}
        </span>
      </button>

      {/* Acknowledgment Panel */}
      {showAcknowledgmentPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Alert Acknowledgment</h2>
                    <p className="text-slate-400">{totalUnacknowledged} unacknowledged critical/high alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAcknowledgmentPanel(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* Acknowledgment Controls */}
              <div className="mt-4 flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Acknowledged By {currentUser && <span className="text-green-400 text-xs">(logged in)</span>}
                  </label>
                  <input
                    type="text"
                    value={acknowledgedBy}
                    onChange={(e) => setAcknowledgedBy(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
                    placeholder={currentUser ? undefined : "Enter your name or ID"}
                    readOnly={!!currentUser}
                  />
                </div>
                <button
                  onClick={handleAcknowledgeAll}
                  disabled={!acknowledgedBy.trim()}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <Check className="h-4 w-4" />
                  <span>Acknowledge All</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Unacknowledged Logs */}
              {unacknowledgedLogs.length > 0 && (
                <div className="p-6 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Critical/High Log Entries ({unacknowledgedLogs.length})
                  </h3>
                  <div className="space-y-3">
                    {unacknowledgedLogs.map((log) => (
                      <div key={log.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                                log.level === 'critical' ? 'bg-red-500/20 text-red-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {log.level}
                              </span>
                              <span className="text-slate-400 text-sm">
                                {format(log.timestamp, 'MMM dd, HH:mm:ss')}
                              </span>
                              <span className="text-slate-400 text-sm">{log.siteName}</span>
                            </div>
                            <p className="text-white font-medium mb-1">{log.message}</p>
                            <div className="text-sm text-slate-400">
                              Source: {log.source} {log.errorCode ? `• Error: ${log.errorCode}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.fileInfo?.filePath && (
                              <ViewLogFileButton filePath={log.fileInfo.filePath} fileName={log.fileInfo.fileName} />
                            )}
                            <button
                              onClick={() => handleAcknowledgeLog(log.id)}
                              disabled={!acknowledgedBy.trim()}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded transition-colors"
                            >
                              <Check className="h-3 w-3" />
                              <span className="text-xs">ACK</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unacknowledged Anomalies */}
              {unacknowledgedAnomalies.length > 0 && (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Critical/High ML Anomalies ({unacknowledgedAnomalies.length})
                  </h3>
                  <div className="space-y-3">
                    {unacknowledgedAnomalies.map(anomaly => (
                      <div key={anomaly.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                                anomaly.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {anomaly.severity}
                              </span>
                              <span className="text-slate-400 text-sm">
                                {format(anomaly.timestamp, 'MMM dd, HH:mm:ss')}
                              </span>
                              <span className="text-slate-400 text-sm">{anomaly.siteName}</span>
                              <span className="text-purple-400 font-bold">{anomaly.score}</span>
                            </div>
                            <p className="text-white font-medium mb-1">{anomaly.description}</p>
                            <div className="text-sm text-slate-400">
                              Type: {anomaly.type} • Confidence: {anomaly.details.confidence}%
                            </div>
                          </div>
                          <button
                            onClick={() => handleAcknowledgeAnomaly(anomaly.id)}
                            disabled={!acknowledgedBy.trim()}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded transition-colors"
                          >
                            <Check className="h-3 w-3" />
                            <span className="text-xs">ACK</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}