import React from 'react';
import { SystemMetrics } from '../types';
import { 
  Server, 
  Activity, 
  AlertTriangle, 
  Clock, 
  TrendingUp,
  Database
} from 'lucide-react';

interface SystemMetricsProps {
  metrics: SystemMetrics;
}

export function SystemMetricsPanel({ metrics }: SystemMetricsProps) {
  const metricCards = [
    {
      title: 'Total Sites',
      value: metrics.totalSites,
      icon: Server,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Active Sites',
      value: `${metrics.activeSites}/${metrics.totalSites}`,
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Total Logs',
      value: metrics.totalLogs.toLocaleString(),
      icon: Database,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Logs/Hour',
      value: metrics.logsPerHour.toLocaleString(),
      icon: TrendingUp,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    },
    {
      title: 'ML Anomalies',
      value: metrics.anomaliesDetected,
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      title: 'Avg Response',
      value: metrics.avgResponseTime > 0 ? `${metrics.avgResponseTime.toFixed(2)}s` : '0s',
      icon: Clock,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10'
    }
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Main System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricCards.map((metric) => {
          const IconComponent = metric.icon;
          return (
            <div
              key={metric.title}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:bg-slate-750 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{metric.value}</div>
                  <div className="text-xs text-slate-400">{metric.title}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}