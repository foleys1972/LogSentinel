import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Target,
  Zap,
  Calendar,
  Activity,
  X
} from 'lucide-react';
import { Site, LogEntry, MLAnomaly } from '../types';
import { PredictiveAnalytics, PredictionResult, CapacityForecast, SeasonalPattern, ServerPredictionsPayload } from '../utils/predictiveAnalytics';
import { RootCauseAnalyzer } from '../utils/rootCauseAnalysis';
import { format, addHours } from 'date-fns';

interface PredictiveAnalyticsPanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  serverPredictions?: ServerPredictionsPayload | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PredictiveAnalyticsPanel({ 
  sites, 
  logs, 
  anomalies,
  serverPredictions,
  isOpen, 
  onClose 
}: PredictiveAnalyticsPanelProps) {
  const [activeTab, setActiveTab] = useState<'predictions' | 'capacity' | 'patterns' | 'rootcause'>('predictions');
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [capacityForecasts, setCapacityForecasts] = useState<CapacityForecast[]>([]);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LogEntry | MLAnomaly | null>(null);
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (serverPredictions) {
        setPredictions(serverPredictions.predictions);
        setCapacityForecasts(serverPredictions.capacityForecasts);
        setSeasonalPatterns(serverPredictions.seasonalPatterns.map(p => ({
          ...p,
          nextOccurrence: new Date(p.nextOccurrence)
        })));
      } else {
        runAnalysis();
      }
    }
  }, [isOpen, sites, logs, anomalies, serverPredictions]);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const failurePredictions = PredictiveAnalytics.predictFailures(sites, logs, anomalies);
      const capacityData = PredictiveAnalytics.forecastCapacity(sites, logs);
      const patterns = PredictiveAnalytics.detectSeasonalPatterns(logs);
      
      setPredictions(failurePredictions);
      setCapacityForecasts(capacityData);
      setSeasonalPatterns(patterns);
    } catch (error) {
      console.error('Error running predictive analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeRootCause = (event: LogEntry | MLAnomaly) => {
    setSelectedEvent(event);
    setIsAnalyzing(true);
    
    try {
      const analysis = RootCauseAnalyzer.analyzeRootCause(event, logs, anomalies, sites);
      setRootCauseAnalysis(analysis);
      setActiveTab('rootcause');
    } catch (error) {
      console.error('Error analyzing root cause:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
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
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Brain className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Predictive Analytics & AI Insights</h2>
                <p className="text-slate-400">Advanced ML-powered analysis and predictions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={runAnalysis}
                disabled={isAnalyzing}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors"
              >
                <Brain className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
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

          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            {[
              { id: 'predictions', label: 'Failure Predictions', icon: AlertTriangle },
              { id: 'capacity', label: 'Capacity Forecasting', icon: TrendingUp },
              { id: 'patterns', label: 'Seasonal Patterns', icon: Calendar },
              { id: 'rootcause', label: 'Root Cause Analysis', icon: Target }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
          {/* Failure Predictions */}
          {activeTab === 'predictions' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">System Failure Predictions</h3>
                <div className="flex items-center gap-3">
                  {serverPredictions && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Live from server
                    </span>
                  )}
                  <span className="text-sm text-slate-400">2-4 hour prediction window</span>
                </div>
              </div>

              {predictions.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">No Imminent Failures Predicted</h4>
                  <p className="text-slate-400">All systems appear stable based on current patterns</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {predictions.map((prediction, idx) => (
                    <div key={`pred-${idx}-${prediction.affectedSites?.[0] ?? ''}`} className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <div className="p-2 bg-red-500/20 rounded-lg">
                            <AlertTriangle className="h-6 w-6 text-red-400" />
                          </div>
                          <div>
                            <h4 className="text-white font-semibold text-lg">{prediction.description}</h4>
                            <div className="flex items-center space-x-4 mt-2 text-sm">
                              <span className="text-red-400 font-medium">
                                Confidence: {prediction.confidence.toFixed(1)}%
                              </span>
                              <span className="text-orange-400">
                                ETA: {prediction.timeToEvent.toFixed(1)} hours
                              </span>
                              <span className="text-blue-400">
                                Predicted: {format(addHours(new Date(), prediction.timeToEvent), 'MMM dd, HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${getSeverityColor('critical')}`}>
                          {prediction.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-slate-300 font-medium mb-3">Affected Sites</h5>
                          <div className="space-y-2">
                            {prediction.affectedSites.map(siteId => {
                              const site = sites.find(s => s.id === siteId);
                              return (
                                <div key={siteId} className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                  <span className="text-white">{site?.name || siteId}</span>
                                  <span className="text-slate-400 text-sm">({site?.location})</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-slate-300 font-medium mb-3">Recommended Actions</h5>
                          <ul className="space-y-2">
                            {prediction.recommendedActions.map((action, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-1">•</span>
                                <span className="text-slate-300 text-sm">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Capacity Forecasting */}
          {activeTab === 'capacity' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Capacity Forecasting</h3>
                <span className="text-sm text-slate-400">24-hour forecast window</span>
              </div>

              {capacityForecasts.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">Capacity Levels Normal</h4>
                  <p className="text-slate-400">All sites operating within normal capacity ranges</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {capacityForecasts.map(forecast => (
                    <div key={forecast.siteId} className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-white font-semibold text-lg">{forecast.siteName}</h4>
                          <p className="text-slate-400">Capacity utilization forecast</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-orange-400">
                            {(forecast.capacityUtilization * 100).toFixed(1)}%
                          </div>
                          <div className="text-sm text-slate-400">Utilization</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <div className="text-lg font-bold text-blue-400">{forecast.currentLogVolume.toLocaleString()}</div>
                          <div className="text-sm text-slate-400">Current Volume (24h)</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <div className="text-lg font-bold text-purple-400">{forecast.predictedVolume.toLocaleString()}</div>
                          <div className="text-sm text-slate-400">Predicted Volume (24h)</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                          <div className="text-lg font-bold text-orange-400">
                            {forecast.timeToCapacity === Infinity ? '∞' : `${forecast.timeToCapacity.toFixed(1)}h`}
                          </div>
                          <div className="text-sm text-slate-400">Time to 90% Capacity</div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-slate-300 font-medium mb-3">Recommended Actions</h5>
                        <ul className="space-y-2">
                          {forecast.recommendedActions.map((action, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-orange-400 mt-1">•</span>
                              <span className="text-slate-300 text-sm">{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seasonal Patterns */}
          {activeTab === 'patterns' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Seasonal Pattern Detection</h3>
                <span className="text-sm text-slate-400">ML-detected recurring patterns</span>
              </div>

              <div className="space-y-4">
                {seasonalPatterns.map((pattern, index) => (
                  <div key={index} className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Calendar className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold text-lg capitalize">{pattern.pattern} Pattern</h4>
                          <p className="text-slate-300 mt-1">{pattern.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">
                          {(pattern.confidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-slate-400">Confidence</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h5 className="text-slate-300 font-medium mb-2">Peak Times</h5>
                        <div className="space-y-1">
                          {pattern.peakTimes.map((time, i) => (
                            <span key={i} className="inline-block bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-sm mr-2 mb-1">
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-slate-300 font-medium mb-2">Expected Increase</h5>
                        <div className="text-lg font-bold text-orange-400">
                          +{pattern.expectedIncrease.toFixed(1)}%
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="text-slate-300 font-medium mb-2">Next Occurrence</h5>
                        <div className="text-sm text-slate-300">
                          {format(pattern.nextOccurrence, 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Root Cause Analysis */}
          {activeTab === 'rootcause' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Root Cause Analysis</h3>
                <span className="text-sm text-slate-400">AI-powered correlation analysis</span>
              </div>

              {!rootCauseAnalysis ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h4 className="text-white font-medium mb-2">Select an Event to Analyze</h4>
                  <p className="text-slate-400 mb-6">Click on any critical log entry or anomaly to perform root cause analysis</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                    <div>
                      <h5 className="text-slate-300 font-medium mb-3">Recent Critical Logs</h5>
                      <div className="space-y-2">
                        {logs.filter(log => log.level === 'critical').slice(0, 5).map(log => (
                          <button
                            key={log.id}
                            onClick={() => analyzeRootCause(log)}
                            className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                          >
                            <div className="text-white font-medium truncate">{log.message}</div>
                            <div className="text-slate-400 text-sm">{format(log.timestamp, 'MMM dd, HH:mm')} • {log.siteName}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-slate-300 font-medium mb-3">High-Score Anomalies</h5>
                      <div className="space-y-2">
                        {anomalies.filter(anomaly => anomaly.score > 70).slice(0, 5).map(anomaly => (
                          <button
                            key={anomaly.id}
                            onClick={() => analyzeRootCause(anomaly)}
                            className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-white font-medium truncate">{anomaly.description}</div>
                              <div className="text-purple-400 font-bold">{anomaly.score}</div>
                            </div>
                            <div className="text-slate-400 text-sm">{format(anomaly.timestamp, 'MMM dd, HH:mm')} • {anomaly.siteName}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Primary Event */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                    <h4 className="text-white font-semibold mb-4">Primary Event Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-slate-300 font-medium mb-2">Root Cause</h5>
                        <p className="text-white">{rootCauseAnalysis.rootCause}</p>
                        <div className="mt-2">
                          <span className="text-green-400 font-medium">
                            Confidence: {(rootCauseAnalysis.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <h5 className="text-slate-300 font-medium mb-2">Correlation Score</h5>
                        <div className="text-2xl font-bold text-blue-400">
                          {(rootCauseAnalysis.correlationScore * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                    <h4 className="text-white font-semibold mb-4">Event Timeline</h4>
                    <div className="space-y-3">
                      {rootCauseAnalysis.timeline.map((timelineEvent: any, index: number) => (
                        <div key={index} className="flex items-start space-x-4">
                          <div className={`w-3 h-3 rounded-full mt-2 ${
                            timelineEvent.impact === 'trigger' ? 'bg-red-400' :
                            timelineEvent.impact === 'cascade' ? 'bg-orange-400' : 'bg-blue-400'
                          }`}></div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-white font-medium">{timelineEvent.description}</span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                timelineEvent.impact === 'trigger' ? 'bg-red-500/20 text-red-400' :
                                timelineEvent.impact === 'cascade' ? 'bg-orange-500/20 text-orange-400' : 
                                'bg-blue-500/20 text-blue-400'
                              }`}>
                                {timelineEvent.impact}
                              </span>
                            </div>
                            <div className="text-slate-400 text-sm">
                              {format(timelineEvent.timestamp, 'MMM dd, HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-slate-900 border border-slate-600 rounded-lg p-6">
                    <h4 className="text-white font-semibold mb-4">Recommended Actions</h4>
                    <ul className="space-y-2">
                      {rootCauseAnalysis.recommendedActions.map((action: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-green-400 mt-1">•</span>
                          <span className="text-slate-300">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}