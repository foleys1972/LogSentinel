import React from 'react';
import { Site, LogEntry, MLAnomaly } from '../types';
import { 
  MapPin, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Server,
  TrendingUp,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { ViewLogFileButton } from './ViewLogFileButton';

interface SiteDetailsProps {
  site: Site;
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  onClose: () => void;
}

export function SiteDetails({ site, logs, anomalies, onClose }: SiteDetailsProps) {
  const siteLogs = logs.filter(log => log.siteId === site.id).slice(0, 10);
  const siteAnomalies = anomalies.filter(anomaly => anomaly.siteId === site.id).slice(0, 5);
  const unacknowledgedCount = logs.filter(
    (l) => l.siteId === site.id && !l.acknowledged && ['critical', 'high'].includes(l.level)
  ).length + anomalies.filter(
    (a) => a.siteId === site.id && !a.acknowledged && ['critical', 'high'].includes(a.severity)
  ).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'amber':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'red':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${getStatusColor(site.status)} border`}>
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{site.name}</h2>
                <p className="text-slate-400 flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {site.location}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unacknowledgedCount > 0 && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-alert-panel'))}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                >
                  <AlertTriangle className="h-4 w-4" />
                  View {unacknowledgedCount} alert{unacknowledgedCount !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Health Overview */}
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Health Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-white">{site.healthScore}</div>
                <div className="text-sm text-slate-400">Health Score</div>
                <div className={`mt-2 px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(site.status)}`}>
                  {site.status}
                </div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{site.alertCounts.critical}</div>
                <div className="text-sm text-slate-400">Critical Alerts</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-400">{site.alertCounts.high}</div>
                <div className="text-sm text-slate-400">High Alerts</div>
              </div>
              <div className="bg-slate-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-slate-400">
                  {format(site.lastUpdate, 'HH:mm:ss')}
                </div>
                <div className="text-sm text-slate-400">Last Update</div>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-green-400" />
              Recent Logs
            </h3>
            {siteLogs.length === 0 ? (
              <p className="text-slate-400">No recent logs</p>
            ) : (
              <div className="space-y-2">
                {siteLogs.map(log => (
                  <div key={log.id} className="bg-slate-900 p-3 rounded-lg flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm">{log.message}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {format(log.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-400 flex-wrap gap-1">
                        <span className={`px-2 py-1 rounded capitalize ${
                          log.level === 'critical' ? 'bg-red-500/20 text-red-400' :
                          log.level === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          log.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {log.level}
                        </span>
                        <span>{log.source}</span>
                        {log.errorCode && <span>{log.errorCode}</span>}
                      </div>
                    </div>
                    {log.fileInfo?.filePath && (
                      <ViewLogFileButton
                        filePath={log.fileInfo.filePath}
                        fileName={log.fileInfo.fileName}
                        className="flex-shrink-0"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ML Anomalies */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-purple-400" />
              ML Anomalies Detected
            </h3>
            {siteAnomalies.length === 0 ? (
              <p className="text-slate-400">No anomalies detected</p>
            ) : (
              <div className="space-y-3">
                {siteAnomalies.map(anomaly => (
                  <div key={anomaly.id} className="bg-slate-900 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{anomaly.description}</span>
                      <span className="text-lg font-bold text-orange-400">
                        {anomaly.score}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <span>{format(anomaly.timestamp, 'MMM dd, HH:mm')}</span>
                      <span className="px-2 py-1 bg-slate-700 rounded capitalize">
                        {anomaly.type}
                      </span>
                      <span className={`px-2 py-1 rounded capitalize ${
                        anomaly.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        anomaly.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        anomaly.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {anomaly.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}