import React, { useState } from 'react';
import { MLAnomaly } from '../types';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Clock, 
  Target, 
  Layers,
  TreePine,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

interface MLAnomaliesProps {
  anomalies: MLAnomaly[];
}

export function MLAnomaliesPanel({ anomalies }: MLAnomaliesProps) {
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);

  const getTypeLabel = (type: string) => type === 'isolation_forest' ? 'Isolation Forest' : type.replace(/_/g, ' ');
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pattern':
        return <TrendingUp className="h-4 w-4 text-purple-400" />;
      case 'behavior':
        return <Users className="h-4 w-4 text-blue-400" />;
      case 'timeseries':
        return <Clock className="h-4 w-4 text-green-400" />;
      case 'threshold':
        return <Target className="h-4 w-4 text-orange-400" />;
      case 'clustering':
        return <Layers className="h-4 w-4 text-cyan-400" />;
      case 'isolation_forest':
        return <TreePine className="h-4 w-4 text-emerald-400" />;
      default:
        return <Brain className="h-4 w-4 text-slate-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-orange-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Brain className="h-5 w-5 text-purple-400 mr-2" />
          ML Anomaly Detection
          <span className="ml-2 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
            AI ACTIVE
          </span>
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Live learning system detecting suspicious patterns
        </p>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {anomalies.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No anomalies detected</p>
            <p className="text-xs mt-1">System is learning from incoming data</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className={`border-l-4 ${getSeverityColor(anomaly.severity)} p-3 rounded-r-lg hover:bg-slate-750 transition-colors duration-150`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getTypeIcon(anomaly.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">
                            {anomaly.description}
                          </span>
                          <span className={`text-lg font-bold ${getScoreColor(anomaly.score)}`}>
                            {anomaly.score}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => setExpandedAnomaly(
                            expandedAnomaly === anomaly.id ? null : anomaly.id
                          )}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {expandedAnomaly === anomaly.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-slate-400 mb-2">
                        <span>{format(anomaly.timestamp, 'MMM dd, HH:mm')}</span>
                        <span>{anomaly.siteName}</span>
                        <span className="px-2 py-0.5 bg-slate-700 rounded capitalize">
                          {getTypeLabel(anomaly.type)}
                        </span>
                        <span className={`px-2 py-0.5 rounded capitalize ${getSeverityColor(anomaly.severity)}`}>
                          {anomaly.severity}
                        </span>
                      </div>
                      
                      {expandedAnomaly === anomaly.id && (
                        <div className="mt-3 p-3 bg-slate-900 rounded border border-slate-600 space-y-4">
                          {(anomaly.aiSummary || anomaly.aiRemediation) && (
                            <div className="space-y-2">
                              {anomaly.aiSummary && (
                                <div>
                                  <h4 className="text-xs font-medium text-amber-400 mb-1">AI Summary</h4>
                                  <p className="text-sm text-slate-300">{anomaly.aiSummary}</p>
                                </div>
                              )}
                              {anomaly.aiRemediation && (
                                <div>
                                  <h4 className="text-xs font-medium text-green-400 mb-1">Suggested Remediation</h4>
                                  <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{anomaly.aiRemediation}</pre>
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <h4 className="text-sm font-medium text-white mb-2 flex items-center">
                              <Info className="h-4 w-4 mr-2 text-blue-400" />
                              Anomaly Details
                            </h4>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Baseline:</span>
                                <span className="text-white">{anomaly.details?.baseline}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Current Value:</span>
                                <span className="text-white">{anomaly.details?.current}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Pattern:</span>
                                <span className="text-white">{anomaly.details?.pattern}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Confidence:</span>
                                <span className="text-white">{anomaly.details?.confidence}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}