import React, { useState, useEffect } from 'react';
import { Monitor, Activity, AlertTriangle, TrendingUp, X, Maximize2 } from 'lucide-react';
import { Site, LogEntry, MLAnomaly, SystemMetrics } from '../../types';
import { format } from 'date-fns';

interface NOCWallDisplayProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  metrics: SystemMetrics | null;
  isOpen: boolean;
  onClose: () => void;
}

interface AlertSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export function NOCWallDisplay({ 
  sites, 
  logs, 
  anomalies, 
  metrics, 
  isOpen, 
  onClose 
}: NOCWallDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertSummary, setAlertSummary] = useState<AlertSummary>({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Calculate alert summary
    const summary = {
      critical: logs.filter(log => log.level === 'critical' && !log.acknowledged).length +
                anomalies.filter(anomaly => anomaly.severity === 'critical' && !anomaly.acknowledged).length,
      high: logs.filter(log => log.level === 'high' && !log.acknowledged).length +
            anomalies.filter(anomaly => anomaly.severity === 'high' && !anomaly.acknowledged).length,
      medium: logs.filter(log => log.level === 'medium' && !log.acknowledged).length +
              anomalies.filter(anomaly => anomaly.severity === 'medium' && !anomaly.acknowledged).length,
      low: logs.filter(log => log.level === 'low' && !log.acknowledged).length +
           anomalies.filter(anomaly => anomaly.severity === 'low' && !anomaly.acknowledged).length,
      total: 0
    };
    summary.total = summary.critical + summary.high + summary.medium + summary.low;
    setAlertSummary(summary);
  }, [logs, anomalies]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const getHealthColor = (health: number) => {
    if (health >= 90) return 'text-green-400';
    if (health >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'amber': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 text-white overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Monitor className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">LogSentinel NOC</h1>
                <p className="text-slate-400">Network Operations Center • Live Monitoring Dashboard</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-blue-400">
                {format(currentTime, 'HH:mm:ss')}
              </div>
              <div className="text-slate-400">
                {format(currentTime, 'EEEE, MMMM dd, yyyy')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 h-[calc(100vh-100px)] overflow-y-auto">
        {/* Top Row - System Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* System Health */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">System Health</h3>
              <Activity className="h-8 w-8 text-green-400" />
            </div>
            <div className="text-center">
              <div className={`text-6xl font-bold mb-2 ${getHealthColor(metrics?.systemHealth || 0)}`}>
                {metrics?.systemHealth || 0}%
              </div>
              <div className="text-slate-400">Overall Health Score</div>
            </div>
          </div>

          {/* Active Alerts */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Active Alerts</h3>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-red-400">Critical</span>
                <span className="text-3xl font-bold text-red-400">{alertSummary.critical}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-orange-400">High</span>
                <span className="text-2xl font-bold text-orange-400">{alertSummary.high}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-400">Medium</span>
                <span className="text-xl font-bold text-yellow-400">{alertSummary.medium}</span>
              </div>
            </div>
          </div>

          {/* Site Status */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Site Status</h3>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-400">Healthy</span>
                <span className="text-2xl font-bold text-green-400">
                  {sites.filter(s => s.status === 'green').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-yellow-400">Warning</span>
                <span className="text-2xl font-bold text-yellow-400">
                  {sites.filter(s => s.status === 'amber').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-red-400">Critical</span>
                <span className="text-2xl font-bold text-red-400">
                  {sites.filter(s => s.status === 'red').length}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Performance</h3>
              <Activity className="h-8 w-8 text-purple-400" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-slate-400 text-sm">Logs/Hour</div>
                <div className="text-2xl font-bold text-white">
                  {metrics?.logsPerHour.toLocaleString() || 0}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">Avg Response</div>
                <div className="text-xl font-bold text-white">
                  {metrics?.avgResponseTime.toFixed(2) || 0}s
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">ML Anomalies</div>
                <div className="text-xl font-bold text-purple-400">
                  {metrics?.anomaliesDetected || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row - Site Grid */}
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-white mb-4">Site Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {sites.map(site => (
              <div key={site.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-4 h-4 rounded-full ${getStatusColor(site.status)} animate-pulse`}></div>
                  <div className={`text-lg font-bold ${getHealthColor(site.healthScore)}`}>
                    {site.healthScore}%
                  </div>
                </div>
                
                <h4 className="text-white font-medium text-sm mb-1 truncate">{site.name}</h4>
                <p className="text-slate-400 text-xs mb-3 truncate">{site.location}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500">Critical</div>
                    <div className="text-red-400 font-bold">{site.alertCounts.critical}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">High</div>
                    <div className="text-orange-400 font-bold">{site.alertCounts.high}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Row - Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Critical Events */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Recent Critical Events</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {logs
                .filter(log => log.level === 'critical')
                .slice(0, 10)
                .map(log => (
                  <div key={log.id} className="flex items-start space-x-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium text-sm truncate">{log.siteName}</span>
                        <span className="text-slate-400 text-xs">{format(log.timestamp, 'HH:mm')}</span>
                      </div>
                      <p className="text-slate-300 text-sm truncate">{log.message}</p>
                      <div className="text-slate-400 text-xs mt-1">{log.source}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* ML Anomalies */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">ML Anomaly Detection</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {anomalies
                .filter(anomaly => anomaly.score > 70)
                .slice(0, 10)
                .map(anomaly => (
                  <div key={anomaly.id} className="flex items-start space-x-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium text-sm truncate">{anomaly.siteName}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-purple-400 font-bold text-sm">{anomaly.score}</span>
                          <span className="text-slate-400 text-xs">{format(anomaly.timestamp, 'HH:mm')}</span>
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm truncate">{anomaly.description}</p>
                      <div className="text-slate-400 text-xs mt-1 capitalize">{anomaly.type} • {anomaly.severity}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400">LIVE</span>
            </div>
            <span className="text-slate-400">
              Monitoring {sites.length} sites • {metrics?.totalLogs.toLocaleString() || 0} total logs
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">
              Last Update: {format(currentTime, 'HH:mm:ss')}
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-blue-400">LogSentinel Enterprise v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}