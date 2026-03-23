import React, { useState, useEffect } from 'react';
import { Wrench, TrendingUp, AlertTriangle, Calendar, Clock, X, Zap, Activity } from 'lucide-react';
import { Site, LogEntry, MLAnomaly } from '../../types';
import { format, addDays, addHours } from 'date-fns';

interface PredictiveMaintenancePanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  isOpen: boolean;
  onClose: () => void;
}

interface MaintenancePrediction {
  id: string;
  siteId: string;
  siteName: string;
  component: string;
  type: 'hardware' | 'software' | 'network' | 'storage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  timeToFailure: number; // hours
  predictedFailureDate: Date;
  indicators: string[];
  recommendedActions: string[];
  estimatedDowntime: number; // hours
  maintenanceWindow: {
    start: Date;
    end: Date;
    description: string;
  };
}

interface ComponentHealth {
  component: string;
  health: number;
  trend: 'improving' | 'stable' | 'declining';
  lastMaintenance?: Date;
  nextMaintenance?: Date;
  mtbf: number; // Mean Time Between Failures in hours
  mttr: number; // Mean Time To Repair in hours
}

export function PredictiveMaintenancePanel({ 
  sites, 
  logs, 
  anomalies, 
  isOpen, 
  onClose 
}: PredictiveMaintenancePanelProps) {
  const [predictions, setPredictions] = useState<MaintenancePrediction[]>([]);
  const [componentHealth, setComponentHealth] = useState<Record<string, ComponentHealth[]>>({});
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [timeHorizon, setTimeHorizon] = useState<'24h' | '7d' | '30d'>('7d');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      runPredictiveAnalysis();
    }
  }, [sites, logs, anomalies, isOpen, timeHorizon]);

  const runPredictiveAnalysis = async () => {
    setIsAnalyzing(true);
    
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newPredictions = generateMaintenancePredictions();
    const healthData = generateComponentHealth();
    
    setPredictions(newPredictions);
    setComponentHealth(healthData);
    setIsAnalyzing(false);
  };

  const generateMaintenancePredictions = (): MaintenancePrediction[] => {
    const predictions: MaintenancePrediction[] = [];
    const components = ['CPU', 'Memory', 'Storage', 'Network Interface', 'Power Supply', 'Cooling System'];
    const types: Array<'hardware' | 'software' | 'network' | 'storage'> = ['hardware', 'software', 'network', 'storage'];
    
    sites.forEach(site => {
      // Analyze site logs for failure indicators
      const siteLogs = logs.filter(log => log.siteId === site.id);
      const siteAnomalies = anomalies.filter(anomaly => anomaly.siteId === site.id);
      
      // Generate predictions based on patterns
      if (siteLogs.length > 0 || siteAnomalies.length > 0) {
        const numPredictions = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numPredictions; i++) {
          const component = components[Math.floor(Math.random() * components.length)];
          const type = types[Math.floor(Math.random() * types.length)];
          const confidence = Math.random() * 40 + 60; // 60-100%
          const timeToFailure = Math.random() * 168 + 24; // 24-192 hours
          const severity = confidence > 85 ? 'critical' : confidence > 70 ? 'high' : confidence > 55 ? 'medium' : 'low';
          
          predictions.push({
            id: `pred_${site.id}_${i}`,
            siteId: site.id,
            siteName: site.name,
            component,
            type,
            severity,
            confidence,
            timeToFailure,
            predictedFailureDate: addHours(new Date(), timeToFailure),
            indicators: generateFailureIndicators(component, type),
            recommendedActions: generateRecommendedActions(component, type),
            estimatedDowntime: Math.random() * 8 + 2, // 2-10 hours
            maintenanceWindow: {
              start: addHours(new Date(), timeToFailure - 24),
              end: addHours(new Date(), timeToFailure - 20),
              description: `Preventive maintenance for ${component}`
            }
          });
        }
      }
    });
    
    return predictions.sort((a, b) => a.timeToFailure - b.timeToFailure);
  };

  const generateComponentHealth = (): Record<string, ComponentHealth[]> => {
    const healthData: Record<string, ComponentHealth[]> = {};
    const components = ['CPU', 'Memory', 'Storage', 'Network', 'Power', 'Cooling'];
    
    sites.forEach(site => {
      healthData[site.id] = components.map(component => ({
        component,
        health: Math.random() * 40 + 60,
        trend: Math.random() > 0.6 ? 'declining' : Math.random() > 0.3 ? 'stable' : 'improving',
        lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        nextMaintenance: addDays(new Date(), Math.random() * 60 + 30),
        mtbf: Math.random() * 2000 + 1000,
        mttr: Math.random() * 8 + 2
      }));
    });
    
    return healthData;
  };

  const generateFailureIndicators = (component: string, type: string): string[] => {
    const indicators: Record<string, string[]> = {
      CPU: ['High temperature readings', 'Increased error rates', 'Performance degradation'],
      Memory: ['Memory leaks detected', 'Increased swap usage', 'ECC errors'],
      Storage: ['Bad sector count increasing', 'SMART warnings', 'I/O latency spikes'],
      'Network Interface': ['Packet loss increasing', 'CRC errors', 'Link flapping'],
      'Power Supply': ['Voltage fluctuations', 'Temperature anomalies', 'Fan speed variations'],
      'Cooling System': ['Temperature trending up', 'Fan failures', 'Airflow restrictions']
    };
    
    return indicators[component] || ['Performance degradation', 'Error rate increase', 'Anomalous behavior'];
  };

  const generateRecommendedActions = (component: string, type: string): string[] => {
    const actions: Record<string, string[]> = {
      CPU: ['Schedule thermal paste replacement', 'Check cooling system', 'Plan CPU upgrade'],
      Memory: ['Run memory diagnostics', 'Plan memory module replacement', 'Check for memory leaks'],
      Storage: ['Backup critical data', 'Schedule disk replacement', 'Run filesystem check'],
      'Network Interface': ['Check cable connections', 'Update network drivers', 'Plan interface replacement'],
      'Power Supply': ['Check power connections', 'Monitor voltage levels', 'Plan PSU replacement'],
      'Cooling System': ['Clean air filters', 'Check fan operation', 'Verify airflow paths']
    };
    
    return actions[component] || ['Monitor closely', 'Schedule inspection', 'Plan replacement'];
  };

  const getTimeHorizonHours = () => {
    switch (timeHorizon) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      default: return 168;
    }
  };

  const filteredPredictions = predictions.filter(pred => {
    const siteMatch = selectedSite === 'all' || pred.siteId === selectedSite;
    const timeMatch = pred.timeToFailure <= getTimeHorizonHours();
    return siteMatch && timeMatch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'declining': return <TrendingUp className="h-4 w-4 text-red-400 transform rotate-180" />;
      case 'stable': return <Activity className="h-4 w-4 text-blue-400" />;
      default: return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Wrench className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Predictive Maintenance</h2>
                <p className="text-slate-400">AI-powered failure prediction and maintenance scheduling</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={runPredictiveAnalysis}
                disabled={isAnalyzing}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white rounded-lg transition-colors"
              >
                <Zap className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Run Analysis'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Site</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option value="all">All Sites</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Time Horizon</label>
              <select
                value={timeHorizon}
                onChange={(e) => setTimeHorizon(e.target.value as any)}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2"
              >
                <option value="24h">Next 24 Hours</option>
                <option value="7d">Next 7 Days</option>
                <option value="30d">Next 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(95vh-180px)]">
          {/* Predictions List */}
          <div className="w-1/2 border-r border-slate-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Maintenance Predictions</h3>
              <span className="text-slate-400 text-sm">
                {filteredPredictions.length} predictions
              </span>
            </div>

            {isAnalyzing ? (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-orange-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-400">Running predictive analysis...</p>
              </div>
            ) : filteredPredictions.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h4 className="text-white font-medium mb-2">No Maintenance Required</h4>
                <p className="text-slate-400">All systems are operating within normal parameters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPredictions.map(prediction => (
                  <div key={prediction.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white font-medium">{prediction.component}</h4>
                        <p className="text-slate-400 text-sm">{prediction.siteName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(prediction.severity)}`}>
                          {prediction.severity}
                        </span>
                        <div className="text-slate-400 text-xs mt-1">
                          {prediction.confidence.toFixed(1)}% confidence
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-slate-400 text-xs">Time to Failure</div>
                        <div className="text-white font-medium">
                          {prediction.timeToFailure < 24 ? 
                            `${Math.round(prediction.timeToFailure)}h` : 
                            `${Math.round(prediction.timeToFailure / 24)}d`
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">Predicted Date</div>
                        <div className="text-white font-medium">
                          {format(prediction.predictedFailureDate, 'MMM dd, HH:mm')}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-slate-400 text-xs mb-1">Key Indicators</div>
                      <div className="flex flex-wrap gap-1">
                        {prediction.indicators.slice(0, 2).map((indicator, index) => (
                          <span key={index} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                            {indicator}
                          </span>
                        ))}
                        {prediction.indicators.length > 2 && (
                          <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                            +{prediction.indicators.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <Calendar className="h-3 w-3 text-blue-400" />
                        <span className="text-blue-400 text-xs font-medium">Maintenance Window</span>
                      </div>
                      <div className="text-white text-xs">
                        {format(prediction.maintenanceWindow.start, 'MMM dd, HH:mm')} - {format(prediction.maintenanceWindow.end, 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Component Health Dashboard */}
          <div className="w-1/2 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Component Health Overview</h3>

            {selectedSite === 'all' ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Select a specific site to view component health details</p>
              </div>
            ) : (
              <div className="space-y-4">
                {componentHealth[selectedSite]?.map((component, index) => (
                  <div key={index} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-white font-medium">{component.component}</h4>
                        {getTrendIcon(component.trend)}
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          component.health > 80 ? 'text-green-400' :
                          component.health > 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {component.health.toFixed(1)}%
                        </div>
                        <div className="text-slate-400 text-xs capitalize">{component.trend}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-slate-400">MTBF</div>
                        <div className="text-white">{Math.round(component.mtbf)}h</div>
                      </div>
                      <div>
                        <div className="text-slate-400">MTTR</div>
                        <div className="text-white">{component.mttr.toFixed(1)}h</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Last Maintenance</div>
                        <div className="text-white">
                          {component.lastMaintenance ? format(component.lastMaintenance, 'MMM dd') : 'Never'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Next Maintenance</div>
                        <div className="text-white">
                          {component.nextMaintenance ? format(component.nextMaintenance, 'MMM dd') : 'TBD'}
                        </div>
                      </div>
                    </div>

                    {/* Health Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            component.health > 80 ? 'bg-green-400' :
                            component.health > 60 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${component.health}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-12">
                    <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-400">No component health data available for this site</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}