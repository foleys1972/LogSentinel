import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Filter, 
  Plus, 
  Play, 
  Settings,
  TrendingUp,
  Table,
  FileText,
  Clock,
  X
} from 'lucide-react';
import { Site, LogEntry, MLAnomaly, ReportConfig, ReportData } from '../types';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TIME_PRESETS: { value: string; label: string; getRange: () => { start: Date; end: Date } }[] = [
  { value: 'daily', label: 'Daily (24h)', getRange: () => ({ start: subDays(new Date(), 1), end: new Date() }) },
  { value: 'weekly', label: 'Weekly (7d)', getRange: () => ({ start: subDays(new Date(), 7), end: new Date() }) },
  { value: 'monthly', label: 'Monthly (30d)', getRange: () => ({ start: subDays(new Date(), 30), end: new Date() }) },
  { value: 'quarterly', label: 'Quarterly (90d)', getRange: () => ({ start: subDays(new Date(), 90), end: new Date() }) },
  { value: 'yearly', label: 'Yearly (365d)', getRange: () => ({ start: subDays(new Date(), 365), end: new Date() }) }
];

interface ReportsPanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  isOpen: boolean;
  onClose: () => void;
}

export function ReportsPanel({ sites, logs, anomalies, isOpen, onClose }: ReportsPanelProps) {
  const [reportConfigs, setReportConfigs] = useState<ReportConfig[]>([]);
  const [generatedReports, setGeneratedReports] = useState<ReportData[]>([]);
  const [activeTab, setActiveTab] = useState<'configs' | 'reports'>('configs');
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  
  const [newConfig, setNewConfig] = useState<Partial<ReportConfig>>({
    name: '',
    description: '',
    type: 'health_trend',
    dateRange: {
      start: subDays(new Date(), 7),
      end: new Date(),
      preset: '7d'
    },
    filters: {
      siteIds: [],
      severityLevels: ['critical', 'high'],
      sources: [],
      errorCodes: []
    },
    visualization: 'both'
  });

  useEffect(() => {
    // Load saved report configs
    const savedConfigs = localStorage.getItem('reportConfigs');
    if (savedConfigs) {
      try {
        const configs = JSON.parse(savedConfigs).map((config: any) => ({
          ...config,
          dateRange: {
            ...config.dateRange,
            start: new Date(config.dateRange.start),
            end: new Date(config.dateRange.end)
          },
          createdAt: new Date(config.createdAt),
          lastRun: config.lastRun ? new Date(config.lastRun) : undefined
        }));
        setReportConfigs(configs);
      } catch (error) {
        console.error('Error loading report configs:', error);
      }
    } else {
      // Create default report configs
      const defaultConfigs = createDefaultReportConfigs();
      setReportConfigs(defaultConfigs);
      localStorage.setItem('reportConfigs', JSON.stringify(defaultConfigs));
    }
  }, []);

  const createDefaultReportConfigs = (): ReportConfig[] => {
    const now = new Date();
    return [
      {
        id: 'health-trend-7d',
        name: 'Weekly Health Trend',
        description: 'Site health trends over the last 7 days',
        type: 'health_trend',
        dateRange: {
          start: subDays(now, 7),
          end: now,
          preset: '7d'
        },
        filters: {
          siteIds: [],
          severityLevels: ['critical', 'high', 'medium'],
          sources: [],
          errorCodes: []
        },
        visualization: 'chart',
        createdAt: now
      },
      {
        id: 'error-analysis-30d',
        name: 'Monthly Error Analysis',
        description: 'Comprehensive error analysis for the last 30 days',
        type: 'error_analysis',
        dateRange: {
          start: subDays(now, 30),
          end: now,
          preset: '30d'
        },
        filters: {
          siteIds: [],
          severityLevels: ['critical', 'high'],
          sources: [],
          errorCodes: []
        },
        visualization: 'both',
        createdAt: now
      },
      {
        id: 'anomaly-summary-6m',
        name: '6-Month Anomaly Summary',
        description: 'ML anomaly detection summary for the last 6 months',
        type: 'anomaly_summary',
        dateRange: {
          start: subMonths(now, 6),
          end: now,
          preset: '6m'
        },
        filters: {
          siteIds: [],
          severityLevels: ['critical', 'high', 'medium'],
          sources: [],
          errorCodes: []
        },
        visualization: 'both',
        createdAt: now
      },
      {
        id: 'alarm-types-weekly',
        name: 'Alarm Types Report',
        description: 'Breakdown by alarm severity (critical, high, medium, low)',
        type: 'alarm_types',
        dateRange: { start: subDays(now, 7), end: now, preset: 'weekly' },
        filters: { siteIds: [], severityLevels: [], sources: [], errorCodes: [] },
        visualization: 'both',
        createdAt: now
      },
      {
        id: 'theme-analysis-monthly',
        name: 'Theme & Pattern Analysis',
        description: 'Recurring themes and patterns in log messages',
        type: 'theme_analysis',
        dateRange: { start: subDays(now, 30), end: now, preset: 'monthly' },
        filters: { siteIds: [], severityLevels: ['critical', 'high', 'medium'], sources: [], errorCodes: [] },
        visualization: 'both',
        createdAt: now
      },
      {
        id: 'peak-hours-monthly',
        name: 'Peak Hours Report',
        description: 'When do most alarms occur? Hourly and daily patterns',
        type: 'peak_hours',
        dateRange: { start: subDays(now, 30), end: now, preset: 'monthly' },
        filters: { siteIds: [], severityLevels: [], sources: [], errorCodes: [] },
        visualization: 'both',
        createdAt: now
      },
      {
        id: 'source-analysis-monthly',
        name: 'Source & File Analysis',
        description: 'Which log files/sources generate most alerts',
        type: 'source_analysis',
        dateRange: { start: subDays(now, 30), end: now, preset: 'monthly' },
        filters: { siteIds: [], severityLevels: [], sources: [], errorCodes: [] },
        visualization: 'both',
        createdAt: now
      }
    ];
  };

  const generateReport = (config: ReportConfig): ReportData => {
    const { dateRange, filters } = config;
    
    // Filter data based on config
    const filteredLogs = logs.filter(log => {
      const inDateRange = log.timestamp >= dateRange.start && log.timestamp <= dateRange.end;
      const siteMatch = filters.siteIds.length === 0 || filters.siteIds.includes(log.siteId);
      const severityMatch = filters.severityLevels.length === 0 || filters.severityLevels.includes(log.level);
      const sourceMatch = filters.sources.length === 0 || filters.sources.includes(log.source);
      const errorMatch = filters.errorCodes.length === 0 || (log.errorCode && filters.errorCodes.includes(log.errorCode));
      
      return inDateRange && siteMatch && severityMatch && sourceMatch && errorMatch;
    });

    const filteredAnomalies = anomalies.filter(anomaly => {
      const inDateRange = anomaly.timestamp >= dateRange.start && anomaly.timestamp <= dateRange.end;
      const siteMatch = filters.siteIds.length === 0 || filters.siteIds.includes(anomaly.siteId);
      const severityMatch = filters.severityLevels.length === 0 || filters.severityLevels.includes(anomaly.severity);
      
      return inDateRange && siteMatch && severityMatch;
    });

    // Generate chart data based on report type
    let chartData: any[] = [];
    let tableData: any[] = [];
    let insights: string[] = [];

    switch (config.type) {
      case 'health_trend':
        chartData = generateHealthTrendData(filteredLogs, dateRange);
        tableData = generateHealthTrendTable(sites, filteredLogs);
        insights = generateHealthInsights(sites, filteredLogs);
        break;
      case 'error_analysis':
        chartData = generateErrorAnalysisData(filteredLogs, dateRange);
        tableData = generateErrorAnalysisTable(filteredLogs);
        insights = generateErrorInsights(filteredLogs);
        break;
      case 'anomaly_summary':
        chartData = generateAnomalyData(filteredAnomalies, dateRange);
        tableData = generateAnomalyTable(filteredAnomalies);
        insights = generateAnomalyInsights(filteredAnomalies);
        break;
      case 'alarm_types':
        chartData = generateAlarmTypesData(filteredLogs);
        tableData = generateAlarmTypesTable(filteredLogs);
        insights = generateAlarmTypesInsights(filteredLogs);
        break;
      case 'theme_analysis':
        chartData = generateThemeData(filteredLogs);
        tableData = generateThemeTable(filteredLogs);
        insights = generateThemeInsights(filteredLogs);
        break;
      case 'peak_hours':
        chartData = generatePeakHoursData(filteredLogs);
        tableData = generatePeakHoursTable(filteredLogs);
        insights = generatePeakHoursInsights(filteredLogs);
        break;
      case 'source_analysis':
        chartData = generateSourceAnalysisData(filteredLogs);
        tableData = generateSourceAnalysisTable(filteredLogs);
        insights = generateSourceAnalysisInsights(filteredLogs);
        break;
      default:
        chartData = generateHealthTrendData(filteredLogs, dateRange);
        tableData = generateHealthTrendTable(sites, filteredLogs);
        insights = ['Custom report generated successfully'];
    }

    const reportData: ReportData = {
      id: `report_${Date.now()}`,
      configId: config.id,
      generatedAt: new Date(),
      dateRange: config.dateRange,
      summary: {
        totalLogs: filteredLogs.length,
        totalErrors: filteredLogs.filter(log => ['critical', 'high'].includes(log.level)).length,
        avgHealthScore: sites.reduce((sum, site) => sum + site.healthScore, 0) / Math.max(sites.length, 1),
        sitesAnalyzed: filters.siteIds.length || sites.length,
        anomaliesDetected: filteredAnomalies.length
      },
      chartData,
      tableData,
      insights
    };

    return reportData;
  };

  const generateHealthTrendData = (logs: LogEntry[], dateRange: any) => {
    const days = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    const data = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      
      const dayLogs = logs.filter(log => 
        log.timestamp >= startOfDay(date) && log.timestamp <= endOfDay(date)
      );
      
      const errorCount = dayLogs.filter(log => ['critical', 'high'].includes(log.level)).length;
      const healthScore = Math.max(0, 100 - (errorCount * 5));
      
      data.push({
        timestamp: date,
        value: healthScore,
        type: 'health'
      });
    }
    
    return data;
  };

  const generateHealthTrendTable = (sites: Site[], logs: LogEntry[]) => {
    return sites.map(site => {
      const siteLogs = logs.filter(log => log.siteId === site.id);
      const errorCount = siteLogs.filter(log => ['critical', 'high'].includes(log.level)).length;
      
      return {
        site: site.name,
        location: site.location,
        healthScore: site.healthScore,
        totalLogs: siteLogs.length,
        errorCount,
        errorRate: siteLogs.length > 0 ? ((errorCount / siteLogs.length) * 100).toFixed(1) + '%' : '0%',
        status: site.status
      };
    });
  };

  const generateHealthInsights = (sites: Site[], logs: LogEntry[]) => {
    const insights = [];
    const avgHealth = sites.reduce((sum, site) => sum + site.healthScore, 0) / Math.max(sites.length, 1);
    
    insights.push(`Average system health: ${avgHealth.toFixed(1)}%`);
    
    const criticalSites = sites.filter(site => site.status === 'red').length;
    if (criticalSites > 0) {
      insights.push(`${criticalSites} site(s) require immediate attention`);
    }
    
    const totalErrors = logs.filter(log => ['critical', 'high'].includes(log.level)).length;
    insights.push(`${totalErrors} critical/high severity events detected`);
    
    return insights;
  };

  const generateErrorAnalysisData = (logs: LogEntry[], dateRange: any) => {
    const errorsByDay = new Map();
    const days = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      const dayLogs = logs.filter(log => 
        log.timestamp >= startOfDay(date) && log.timestamp <= endOfDay(date)
      );
      
      errorsByDay.set(dateKey, {
        critical: dayLogs.filter(log => log.level === 'critical').length,
        high: dayLogs.filter(log => log.level === 'high').length,
        medium: dayLogs.filter(log => log.level === 'medium').length
      });
    }
    
    return Array.from(errorsByDay.entries()).map(([date, counts]) => ({
      timestamp: new Date(date),
      value: counts.critical + counts.high + counts.medium,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      type: 'errors'
    }));
  };

  const generateErrorAnalysisTable = (logs: LogEntry[]) => {
    const errorCounts = new Map();
    
    logs.forEach(log => {
      if (['critical', 'high', 'medium'].includes(log.level)) {
        const key = log.errorCode || 'Unknown';
        if (!errorCounts.has(key)) {
          errorCounts.set(key, { code: key, critical: 0, high: 0, medium: 0, total: 0 });
        }
        const count = errorCounts.get(key);
        count[log.level]++;
        count.total++;
      }
    });
    
    return Array.from(errorCounts.values()).sort((a, b) => b.total - a.total);
  };

  const generateErrorInsights = (logs: LogEntry[]) => {
    const insights = [];
    const errorCodes = new Map();
    
    logs.forEach(log => {
      if (log.errorCode) {
        errorCodes.set(log.errorCode, (errorCodes.get(log.errorCode) || 0) + 1);
      }
    });
    
    const topError = Array.from(errorCodes.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topError) {
      insights.push(`Most frequent error: ${topError[0]} (${topError[1]} occurrences)`);
    }
    
    const criticalCount = logs.filter(log => log.level === 'critical').length;
    insights.push(`${criticalCount} critical errors require immediate attention`);
    
    return insights;
  };

  const generateAnomalyData = (anomalies: MLAnomaly[], dateRange: any) => {
    const anomaliesByDay = new Map();
    const days = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start);
      date.setDate(date.getDate() + i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      const dayAnomalies = anomalies.filter(anomaly => 
        anomaly.timestamp >= startOfDay(date) && anomaly.timestamp <= endOfDay(date)
      );
      
      anomaliesByDay.set(dateKey, dayAnomalies.length);
    }
    
    return Array.from(anomaliesByDay.entries()).map(([date, count]) => ({
      timestamp: new Date(date),
      value: count,
      type: 'anomalies'
    }));
  };

  const generateAnomalyTable = (anomalies: MLAnomaly[]) => {
    return anomalies.map(anomaly => ({
      timestamp: format(anomaly.timestamp, 'MMM dd, HH:mm'),
      site: anomaly.siteName,
      type: anomaly.type,
      description: anomaly.description,
      score: anomaly.score,
      severity: anomaly.severity,
      confidence: anomaly.details.confidence
    })).sort((a, b) => b.score - a.score);
  };

  const generateAnomalyInsights = (anomalies: MLAnomaly[]) => {
    const insights = [];
    const typeCount = new Map();
    
    anomalies.forEach(anomaly => {
      typeCount.set(anomaly.type, (typeCount.get(anomaly.type) || 0) + 1);
    });
    
    const topType = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topType) {
      insights.push(`Most common anomaly type: ${topType[0]} (${topType[1]} occurrences)`);
    }
    
    const highScoreAnomalies = anomalies.filter(a => a.score > 80).length;
    insights.push(`${highScoreAnomalies} high-confidence anomalies detected`);
    
    return insights;
  };

  const generateAlarmTypesData = (logs: LogEntry[]) => {
    const byLevel = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    logs.forEach(log => { if (byLevel[log.level as keyof typeof byLevel] !== undefined) byLevel[log.level as keyof typeof byLevel]++; });
    return Object.entries(byLevel).map(([level, count]) => ({ timestamp: new Date(), value: count, type: level, level }));
  };

  const generateAlarmTypesTable = (logs: LogEntry[]) => {
    const byLevel = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    logs.forEach(log => { if (byLevel[log.level as keyof typeof byLevel] !== undefined) byLevel[log.level as keyof typeof byLevel]++; });
    return Object.entries(byLevel).map(([level, count]) => ({ alarmType: level, count, percentage: logs.length ? ((count / logs.length) * 100).toFixed(1) + '%' : '0%' }));
  };

  const generateAlarmTypesInsights = (logs: LogEntry[]) => {
    const critical = logs.filter(l => l.level === 'critical').length;
    const high = logs.filter(l => l.level === 'high').length;
    return [
      `Critical: ${critical} | High: ${high} | Medium: ${logs.filter(l => l.level === 'medium').length} | Low: ${logs.filter(l => l.level === 'low').length}`,
      critical + high > 0 ? `${critical + high} critical/high alarms require attention` : 'No critical or high alarms in period'
    ];
  };

  const extractThemes = (message: string): string[] => {
    const themes: string[] = [];
    const patterns = [
      { regex: /timeout|timed out|timing out/i, theme: 'Timeout' },
      { regex: /connection|connect|disconnect/i, theme: 'Connection' },
      { regex: /auth|login|password|credential|unauthorized/i, theme: 'Authentication' },
      { regex: /disk|space|storage|full|quota/i, theme: 'Disk/Storage' },
      { regex: /memory|oom|out of memory/i, theme: 'Memory' },
      { regex: /error|exception|failed|failure/i, theme: 'Error/Failure' },
      { regex: /restart|reboot|shutdown/i, theme: 'Restart/Shutdown' },
      { regex: /network|socket|refused|unreachable/i, theme: 'Network' },
      { regex: /database|sql|query/i, theme: 'Database' },
      { regex: /permission|access denied|forbidden/i, theme: 'Permission' },
      { regex: /timeout|retry|retrying/i, theme: 'Retry' }
    ];
    for (const { regex, theme } of patterns) {
      if (regex.test(message) && !themes.includes(theme)) themes.push(theme);
    }
    return themes.length ? themes : ['Other'];
  };

  const generateThemeData = (logs: LogEntry[]) => {
    const themeCount = new Map<string, number>();
    logs.forEach(log => {
      extractThemes(log.message).forEach(t => themeCount.set(t, (themeCount.get(t) || 0) + 1));
    });
    return Array.from(themeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([theme, count]) => ({ timestamp: new Date(), value: count, type: theme }));
  };

  const generateThemeTable = (logs: LogEntry[]) => {
    const themeCount = new Map<string, number>();
    logs.forEach(log => {
      extractThemes(log.message).forEach(t => themeCount.set(t, (themeCount.get(t) || 0) + 1));
    });
    return Array.from(themeCount.entries()).sort((a, b) => b[1] - a[1]).map(([theme, count]) => ({ theme, count, percentage: logs.length ? ((count / logs.length) * 100).toFixed(1) + '%' : '0%' }));
  };

  const generateThemeInsights = (logs: LogEntry[]) => {
    const themeCount = new Map<string, number>();
    logs.forEach(log => extractThemes(log.message).forEach(t => themeCount.set(t, (themeCount.get(t) || 0) + 1)));
    const top = Array.from(themeCount.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? [`Top theme: ${top[0]} (${top[1]} occurrences)`, 'Themes extracted from log message patterns'] : ['No themes detected'];
  };

  const generatePeakHoursData = (logs: LogEntry[]) => {
    const byHour = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    logs.forEach(log => {
      const h = new Date(log.timestamp).getHours();
      byHour[h].count++;
    });
    return byHour.map(({ hour, count }) => ({ timestamp: new Date(2000, 0, 1, hour), value: count, type: `${hour}:00` }));
  };

  const generatePeakHoursTable = (logs: LogEntry[]) => {
    const byHour = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0 }));
    logs.forEach(log => { byHour[new Date(log.timestamp).getHours()].count++; });
    return byHour.filter(h => h.count > 0).sort((a, b) => b.count - a.count).map(({ hour, count }) => ({ hour: `${hour}:00`, count }));
  };

  const generatePeakHoursInsights = (logs: LogEntry[]) => {
    const byHour = Array(24).fill(0);
    logs.forEach(log => byHour[new Date(log.timestamp).getHours()]++);
    const peakHour = byHour.indexOf(Math.max(...byHour));
    const minVal = Math.min(...byHour);
    const quietHour = byHour.indexOf(minVal);
    return [`Peak alarm hour: ${peakHour}:00`, `Quietest hour: ${quietHour}:00`];
  };

  const generateSourceAnalysisData = (logs: LogEntry[]) => {
    const bySource = new Map<string, number>();
    logs.forEach(log => {
      const src = log.source || log.fileInfo?.fileName || 'Unknown';
      bySource.set(src, (bySource.get(src) || 0) + 1);
    });
    return Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([src, count]) => ({ timestamp: new Date(), value: count, type: src }));
  };

  const generateSourceAnalysisTable = (logs: LogEntry[]) => {
    const bySource = new Map<string, number>();
    logs.forEach(log => {
      const src = log.source || log.fileInfo?.fileName || 'Unknown';
      bySource.set(src, (bySource.get(src) || 0) + 1);
    });
    return Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count, percentage: logs.length ? ((count / logs.length) * 100).toFixed(1) + '%' : '0%' }));
  };

  const generateSourceAnalysisInsights = (logs: LogEntry[]) => {
    const bySource = new Map<string, number>();
    logs.forEach(log => {
      const src = log.source || log.fileInfo?.fileName || 'Unknown';
      bySource.set(src, (bySource.get(src) || 0) + 1);
    });
    const top = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? [`Top source: ${top[0]} (${top[1]} occurrences)`, `${bySource.size} unique sources`] : ['No sources'];
  };

  const runReport = (config: ReportConfig) => {
    const reportData = generateReport(config);
    setGeneratedReports(prev => [reportData, ...prev]);
    
    // Update last run time
    const updatedConfigs = reportConfigs.map(c => 
      c.id === config.id ? { ...c, lastRun: new Date() } : c
    );
    setReportConfigs(updatedConfigs);
    localStorage.setItem('reportConfigs', JSON.stringify(updatedConfigs));
    
    setActiveTab('reports');
  };

  const saveNewConfig = () => {
    if (!newConfig.name || !newConfig.description) {
      alert('Please fill in all required fields');
      return;
    }

    const config: ReportConfig = {
      id: `config_${Date.now()}`,
      name: newConfig.name!,
      description: newConfig.description!,
      type: newConfig.type!,
      dateRange: newConfig.dateRange!,
      filters: newConfig.filters!,
      visualization: newConfig.visualization!,
      createdAt: new Date()
    };

    const updatedConfigs = [...reportConfigs, config];
    setReportConfigs(updatedConfigs);
    localStorage.setItem('reportConfigs', JSON.stringify(updatedConfigs));
    setIsCreatingConfig(false);
    
    // Reset form
    setNewConfig({
      name: '',
      description: '',
      type: 'health_trend',
      dateRange: {
        start: subDays(new Date(), 7),
        end: new Date(),
        preset: '7d'
      },
      filters: {
        siteIds: [],
        severityLevels: ['critical', 'high'],
        sources: [],
        errorCodes: []
      },
      visualization: 'both'
    });
  };

  const exportReport = (report: ReportData, format: 'json' | 'csv' = 'json') => {
    if (format === 'csv' && report.tableData.length > 0) {
      const headers = Object.keys(report.tableData[0]).join(',');
      const rows = report.tableData.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${report.configId}_${format(report.generatedAt, 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const exportData = { ...report, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${report.configId}_${format(report.generatedAt, 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const runQuickReport = (preset: typeof TIME_PRESETS[0], type: ReportConfig['type']) => {
    const range = preset.getRange();
    const config: ReportConfig = {
      id: `quick_${Date.now()}`,
      name: `${type.replace('_', ' ')} - ${preset.label}`,
      description: `Quick report`,
      type,
      dateRange: { ...range, preset: preset.value as any },
      filters: { siteIds: [], severityLevels: [], sources: [], errorCodes: [] },
      visualization: 'both',
      createdAt: new Date()
    };
    runReport(config);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Reports & Analytics</h2>
                <p className="text-slate-400">Generate comprehensive reports and trend analysis</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Quick Reporting Dashboard */}
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TIME_PRESETS.map(preset => (
                <div key={preset.value} className="space-y-2">
                  <div className="text-xs text-slate-400">Period: {preset.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {(['alarm_types', 'theme_analysis', 'error_analysis'] as const).map(type => (
                      <button
                        key={`${preset.value}-${type}`}
                        onClick={() => runQuickReport(preset, type)}
                        className="px-2 py-1 text-xs bg-slate-700 hover:bg-blue-600 text-slate-200 rounded"
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            <button
              onClick={() => setActiveTab('configs')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'configs' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Report Configurations
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'reports' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Generated Reports ({generatedReports.length})
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          {activeTab === 'configs' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Report Configurations</h3>
                <button
                  onClick={() => setIsCreatingConfig(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Configuration</span>
                </button>
              </div>

              {/* Create New Config Form */}
              {isCreatingConfig && (
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 mb-6">
                  <h4 className="text-white font-medium mb-4">Create New Report Configuration</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                      <input
                        type="text"
                        value={newConfig.name || ''}
                        onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                        placeholder="Report name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                      <select
                        value={newConfig.type || 'health_trend'}
                        onChange={(e) => setNewConfig({ ...newConfig, type: e.target.value as any })}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                      >
                        <option value="health_trend">Health Trend</option>
                        <option value="error_analysis">Error Analysis</option>
                        <option value="alarm_types">Alarm Types</option>
                        <option value="theme_analysis">Theme & Pattern Analysis</option>
                        <option value="peak_hours">Peak Hours</option>
                        <option value="source_analysis">Source & File Analysis</option>
                        <option value="site_performance">Site Performance</option>
                        <option value="anomaly_summary">Anomaly Summary</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Time Period</label>
                      <select
                        value={newConfig.dateRange?.preset || 'weekly'}
                        onChange={(e) => {
                          const preset = TIME_PRESETS.find(p => p.value === e.target.value);
                          if (preset) setNewConfig({ ...newConfig, dateRange: { ...preset.getRange(), preset: preset.value } });
                        }}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2"
                      >
                        {TIME_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <textarea
                      value={newConfig.description || ''}
                      onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 h-20"
                      placeholder="Report description"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={saveNewConfig}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Save Configuration</span>
                    </button>
                    <button
                      onClick={() => setIsCreatingConfig(false)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Existing Configurations */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportConfigs.map(config => (
                  <div key={config.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white font-medium">{config.name}</h4>
                        <p className="text-slate-400 text-sm mt-1">{config.description}</p>
                      </div>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {config.type.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-4">
                      <div>Range: {config.dateRange.preset || 'custom'}</div>
                      <div>Visualization: {config.visualization}</div>
                      {config.lastRun && (
                        <div>Last run: {format(config.lastRun, 'MMM dd, HH:mm')}</div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => runReport(config)}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      <span>Run Report</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Generated Reports</h3>
              
              {generatedReports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">No reports generated yet</p>
                  <p className="text-slate-500 text-sm">Run a report configuration to see results here</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {generatedReports.map(report => (
                    <div key={report.id} className="bg-slate-900 border border-slate-600 rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-white font-medium">
                              {reportConfigs.find(c => c.id === report.configId)?.name || 'Unknown Report'}
                            </h4>
                            <p className="text-slate-400 text-sm">
                              Generated: {format(report.generatedAt, 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedReport(selectedReport?.id === report.id ? null : report)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                              {selectedReport?.id === report.id ? 'Hide' : 'View'}
                            </button>
                            <button
                              onClick={() => exportReport(report, 'json')}
                              className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                              title="Export JSON"
                            >
                              JSON
                            </button>
                            <button
                              onClick={() => exportReport(report, 'csv')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                              title="Export CSV"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-white">{report.summary.totalLogs}</div>
                            <div className="text-xs text-slate-400">Total Logs</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-400">{report.summary.totalErrors}</div>
                            <div className="text-xs text-slate-400">Errors</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-green-400">{report.summary.avgHealthScore.toFixed(1)}%</div>
                            <div className="text-xs text-slate-400">Avg Health</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-400">{report.summary.sitesAnalyzed}</div>
                            <div className="text-xs text-slate-400">Sites</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-purple-400">{report.summary.anomaliesDetected}</div>
                            <div className="text-xs text-slate-400">Anomalies</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Report Details */}
                      {selectedReport?.id === report.id && (
                        <div className="p-4">
                          {/* Chart */}
                          {report.chartData.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-white font-medium mb-3">Trend Analysis</h5>
                              <div className="h-64 bg-slate-800 rounded p-4">
                                {(report.tableData[0]?.alarmType || report.tableData[0]?.theme || report.tableData[0]?.hour) ? (
                                  <Bar
                                    data={{
                                      labels: report.chartData.map(d => (d as any).type || (d as any).level || format(d.timestamp, 'MMM dd')),
                                      datasets: [{
                                        label: 'Count',
                                        data: report.chartData.map(d => d.value),
                                        backgroundColor: 'rgba(59, 130, 246, 0.7)'
                                      }]
                                    }}
                                    options={{
                                      responsive: true,
                                      maintainAspectRatio: false,
                                      plugins: { legend: { display: false } },
                                      scales: {
                                        x: { ticks: { color: 'rgb(148, 163, 184)', maxRotation: 45 } },
                                        y: { ticks: { color: 'rgb(148, 163, 184)' } }
                                      }
                                    }}
                                  />
                                ) : (
                                  <Line
                                  data={{
                                    labels: report.chartData.map(d => (d as any).type || format(d.timestamp, 'MMM dd')),
                                    datasets: [{
                                      label: 'Value',
                                      data: report.chartData.map(d => d.value),
                                      borderColor: 'rgb(59, 130, 246)',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      fill: true,
                                      tension: 0.4
                                    }]
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { display: false }
                                    },
                                    scales: {
                                      x: { ticks: { color: 'rgb(148, 163, 184)' } },
                                      y: { ticks: { color: 'rgb(148, 163, 184)' } }
                                    }
                                  }}
                                />
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Table */}
                          {report.tableData.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-white font-medium mb-3">Detailed Data</h5>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-700">
                                      {Object.keys(report.tableData[0]).map(key => (
                                        <th key={key} className="text-left text-slate-300 p-2 capitalize">
                                          {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {report.tableData.slice(0, 10).map((row, index) => (
                                      <tr key={index} className="border-b border-slate-800">
                                        {Object.values(row).map((value, i) => (
                                          <td key={i} className="text-slate-300 p-2">
                                            {String(value)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          
                          {/* Insights */}
                          {report.insights.length > 0 && (
                            <div>
                              <h5 className="text-white font-medium mb-3">Key Insights</h5>
                              <ul className="space-y-2">
                                {report.insights.map((insight, index) => (
                                  <li key={index} className="text-slate-300 text-sm flex items-start">
                                    <span className="text-blue-400 mr-2">•</span>
                                    {insight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}