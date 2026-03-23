import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Site, LogEntry } from '../types';
import { TrendingUp, Activity } from 'lucide-react';
import { generateChartData } from '../utils/dataGeneration';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HealthTrendsProps {
  sites: Site[];
  logs?: LogEntry[];
}

export function HealthTrends({ sites, logs = [] }: HealthTrendsProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  const chartData = generateChartData(7, logs, sites);
  const hasMonitoring = sites.some(s =>
    (s.monitoringConfig?.folderPath?.trim() && !s.monitoringConfig.folderPath.includes('example')) ||
    (s.folderMonitoringEnabled && s.folderMonitoringTypes?.length)
  );
  const hasRealData = chartData.length > 0;
  
  const data = {
    labels: chartData.map(point =>
      point.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ),
    datasets: [
      {
        label: 'System Health',
        data: chartData.map(point => point.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Log Volume',
        data: chartData.map(point => point.logCount ?? 0),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(148, 163, 184)',
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(203, 213, 225)',
        borderColor: 'rgb(51, 65, 85)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        ticks: {
          color: 'rgb(148, 163, 184)'
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.5)'
        }
      },
      y: {
        type: 'linear',
        position: 'left',
        ticks: { color: 'rgb(148, 163, 184)' },
        grid: { color: 'rgba(51, 65, 85, 0.5)' },
        min: 0,
        max: 100,
        title: { display: true, text: 'Health %', color: 'rgb(148, 163, 184)' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        ticks: { color: 'rgb(148, 163, 184)' },
        grid: { display: false },
        min: 0,
        title: { display: true, text: 'Logs', color: 'rgb(148, 163, 184)' }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  // No periodic random updates - chart reflects real data only

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <TrendingUp className="h-5 w-5 text-blue-400 mr-2" />
          Health Trends & Analytics
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          {hasRealData ? 'Real-time system health and log volume from monitoring' : 'Configure monitoring to see live data'}
        </p>
      </div>

      <div className="p-4">
        {hasRealData ? (
          <div className="h-64">
            <Line ref={chartRef} data={data} options={options} />
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-600 rounded-lg">
            <Activity className="h-12 w-12 mb-3 opacity-50" />
            <p className="font-medium">No monitoring data</p>
            <p className="text-sm mt-1">
              {hasMonitoring
                ? 'Add folder paths and start monitoring to see health trends'
                : 'Add sites with monitoring paths in Admin → Site Manager'}
            </p>
          </div>
        )}
      </div>
      
      {/* Site health summary */}
      <div className="p-4 border-t border-slate-700 bg-slate-850">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">
              {sites.filter(s => s.status === 'green').length}
            </div>
            <div className="text-xs text-slate-400">Healthy Sites</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {sites.filter(s => s.status === 'amber').length}
            </div>
            <div className="text-xs text-slate-400">Warning Sites</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">
              {sites.filter(s => s.status === 'red').length}
            </div>
            <div className="text-xs text-slate-400">Critical Sites</div>
          </div>
        </div>
      </div>
    </div>
  );
}