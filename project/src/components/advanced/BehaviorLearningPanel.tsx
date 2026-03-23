import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, TrendingUp, Users, Clock, Target, X, Zap, Activity } from 'lucide-react';
import { Site, LogEntry, MLAnomaly } from '../../types';
import { format, subDays, subHours } from 'date-fns';

interface BehaviorLearningPanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  isOpen: boolean;
  onClose: () => void;
}

interface BehaviorProfile {
  id: string;
  name: string;
  type: 'user' | 'system' | 'application' | 'network';
  baseline: {
    avgLogsPerHour: number;
    errorRate: number;
    peakHours: number[];
    commonSources: string[];
    typicalPatterns: string[];
  };
  currentBehavior: {
    logsPerHour: number;
    errorRate: number;
    activeHours: number[];
    activeSources: string[];
    detectedPatterns: string[];
  };
  deviations: Array<{
    metric: string;
    baseline: number;
    current: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  confidence: number;
  lastUpdated: Date;
}

interface LearningInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'trend' | 'correlation';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  evidence: string[];
  timestamp: Date;
}

export function BehaviorLearningPanel({ 
  sites, 
  logs, 
  anomalies, 
  isOpen, 
  onClose 
}: BehaviorLearningPanelProps) {
  const [behaviorProfiles, setBehaviorProfiles] = useState<BehaviorProfile[]>([]);
  const [learningInsights, setLearningInsights] = useState<LearningInsight[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BehaviorProfile | null>(null);
  const [isLearning, setIsLearning] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [hasInitialData, setHasInitialData] = useState(false);
  
  // Use refs to track if analysis is already running
  const analysisRunning = useRef(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Load cached data on mount
  useEffect(() => {
    if (isOpen && !hasInitialData) {
      loadCachedData();
    }
  }, [isOpen, hasInitialData]);

  // Only run analysis when explicitly requested or when data significantly changes
  const shouldRunAnalysis = useCallback(() => {
    if (!isOpen || analysisRunning.current) return false;
    
    // Don't auto-run if we have recent data (less than 5 minutes old)
    if (lastAnalysisTime && (Date.now() - lastAnalysisTime.getTime()) < 5 * 60 * 1000) {
      return false;
    }
    
    // Only run if we have sufficient data
    return logs.length > 10 || anomalies.length > 0;
  }, [isOpen, lastAnalysisTime, logs.length, anomalies.length]);

  const loadCachedData = () => {
    try {
      const cachedProfiles = localStorage.getItem('behaviorProfiles');
      const cachedInsights = localStorage.getItem('learningInsights');
      const cachedAnalysisTime = localStorage.getItem('lastBehaviorAnalysis');
      
      if (cachedProfiles && cachedInsights) {
        const profiles = JSON.parse(cachedProfiles).map((p: any) => ({
          ...p,
          lastUpdated: new Date(p.lastUpdated)
        }));
        const insights = JSON.parse(cachedInsights).map((i: any) => ({
          ...i,
          timestamp: new Date(i.timestamp)
        }));
        
        setBehaviorProfiles(profiles);
        setLearningInsights(insights);
        setHasInitialData(true);
        
        if (cachedAnalysisTime) {
          setLastAnalysisTime(new Date(cachedAnalysisTime));
        }
      }
    } catch (error) {
      console.error('Error loading cached behavior data:', error);
    }
  };

  const saveCachedData = (profiles: BehaviorProfile[], insights: LearningInsight[]) => {
    try {
      localStorage.setItem('behaviorProfiles', JSON.stringify(profiles));
      localStorage.setItem('learningInsights', JSON.stringify(insights));
      localStorage.setItem('lastBehaviorAnalysis', new Date().toISOString());
    } catch (error) {
      console.error('Error saving behavior data:', error);
    }
  };

  const runBehaviorAnalysis = useCallback(async () => {
    if (analysisRunning.current) return;
    
    analysisRunning.current = true;
    setIsLearning(true);
    setLearningProgress(0);
    
    // Clear any existing progress interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    // Simulate learning progress
    progressInterval.current = setInterval(() => {
      setLearningProgress(prev => {
        if (prev >= 95) {
          return 95; // Stop at 95% until analysis completes
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);
    
    try {
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const profiles = generateBehaviorProfiles();
      const insights = generateLearningInsights();
      
      setBehaviorProfiles(profiles);
      setLearningInsights(insights);
      setLastAnalysisTime(new Date());
      setHasInitialData(true);
      
      // Save to cache
      saveCachedData(profiles, insights);
      
      setLearningProgress(100);
    } catch (error) {
      console.error('Error during behavior analysis:', error);
    } finally {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      
      setTimeout(() => {
        setIsLearning(false);
        analysisRunning.current = false;
      }, 500);
    }
  }, [sites, logs, anomalies]);

  // Manual analysis trigger
  const handleManualAnalysis = () => {
    runBehaviorAnalysis();
  };

  const generateBehaviorProfiles = (): BehaviorProfile[] => {
    const profiles: BehaviorProfile[] = [];
    
    // Generate profiles for each site
    sites.forEach(site => {
      const siteLogs = logs.filter(log => log.siteId === site.id);
      const siteAnomalies = anomalies.filter(anomaly => anomaly.siteId === site.id);
      
      if (siteLogs.length > 0) {
        // Calculate baseline behavior (last 7 days)
        const baselineLogs = siteLogs.filter(log => 
          log.timestamp >= subDays(new Date(), 7) && 
          log.timestamp < subDays(new Date(), 1)
        );
        
        // Calculate current behavior (last 24 hours)
        const currentLogs = siteLogs.filter(log => 
          log.timestamp >= subDays(new Date(), 1)
        );
        
        const baseline = calculateBehaviorBaseline(baselineLogs);
        const current = calculateCurrentBehavior(currentLogs);
        const deviations = calculateDeviations(baseline, current);
        
        profiles.push({
          id: `profile_${site.id}`,
          name: `${site.name} System`,
          type: 'system',
          baseline,
          currentBehavior: current,
          deviations,
          confidence: Math.random() * 30 + 70, // 70-100%
          lastUpdated: new Date()
        });
      }
    });
    
    // Generate user behavior profiles
    const userProfiles = generateUserProfiles(logs);
    profiles.push(...userProfiles);
    
    // Generate application profiles
    const appProfiles = generateApplicationProfiles(logs);
    profiles.push(...appProfiles);
    
    return profiles.sort((a, b) => b.confidence - a.confidence);
  };

  const calculateBehaviorBaseline = (logs: LogEntry[]) => {
    const hourlyDistribution = new Array(24).fill(0);
    const sources = new Map<string, number>();
    const patterns = new Set<string>();
    
    logs.forEach(log => {
      hourlyDistribution[log.timestamp.getHours()]++;
      sources.set(log.source, (sources.get(log.source) || 0) + 1);
      
      // Extract patterns from messages
      if (log.errorCode) patterns.add(`error_${log.errorCode}`);
      if (log.level === 'critical') patterns.add('critical_event');
      if (log.message.toLowerCase().includes('timeout')) patterns.add('timeout_pattern');
    });
    
    const avgLogsPerHour = logs.length / 24;
    const errorRate = logs.filter(log => ['critical', 'high'].includes(log.level)).length / Math.max(logs.length, 1);
    const peakHours = hourlyDistribution
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > avgLogsPerHour * 1.5)
      .map(({ hour }) => hour);
    
    return {
      avgLogsPerHour,
      errorRate,
      peakHours,
      commonSources: Array.from(sources.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([source]) => source),
      typicalPatterns: Array.from(patterns).slice(0, 10)
    };
  };

  const calculateCurrentBehavior = (logs: LogEntry[]) => {
    const hourlyDistribution = new Array(24).fill(0);
    const sources = new Set<string>();
    const patterns = new Set<string>();
    
    logs.forEach(log => {
      hourlyDistribution[log.timestamp.getHours()]++;
      sources.add(log.source);
      
      if (log.errorCode) patterns.add(`error_${log.errorCode}`);
      if (log.level === 'critical') patterns.add('critical_event');
      if (log.message.toLowerCase().includes('timeout')) patterns.add('timeout_pattern');
    });
    
    const logsPerHour = logs.length / 24;
    const errorRate = logs.filter(log => ['critical', 'high'].includes(log.level)).length / Math.max(logs.length, 1);
    const activeHours = hourlyDistribution
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count > 0)
      .map(({ hour }) => hour);
    
    return {
      logsPerHour,
      errorRate,
      activeHours,
      activeSources: Array.from(sources),
      detectedPatterns: Array.from(patterns)
    };
  };

  const calculateDeviations = (baseline: any, current: any) => {
    const deviations = [];
    
    // Log volume deviation
    const volumeDeviation = Math.abs(current.logsPerHour - baseline.avgLogsPerHour) / Math.max(baseline.avgLogsPerHour, 1);
    if (volumeDeviation > 0.2) {
      deviations.push({
        metric: 'Log Volume',
        baseline: baseline.avgLogsPerHour,
        current: current.logsPerHour,
        deviation: volumeDeviation,
        severity: volumeDeviation > 1 ? 'critical' : volumeDeviation > 0.5 ? 'high' : 'medium',
        trend: current.logsPerHour > baseline.avgLogsPerHour ? 'declining' : 'improving'
      });
    }
    
    // Error rate deviation
    const errorDeviation = Math.abs(current.errorRate - baseline.errorRate) / Math.max(baseline.errorRate, 0.01);
    if (errorDeviation > 0.3) {
      deviations.push({
        metric: 'Error Rate',
        baseline: baseline.errorRate,
        current: current.errorRate,
        deviation: errorDeviation,
        severity: errorDeviation > 2 ? 'critical' : errorDeviation > 1 ? 'high' : 'medium',
        trend: current.errorRate > baseline.errorRate ? 'declining' : 'improving'
      });
    }
    
    return deviations;
  };

  const generateUserProfiles = (logs: LogEntry[]): BehaviorProfile[] => {
    const userProfiles: BehaviorProfile[] = [];
    const users = new Set(logs.filter(log => log.userId).map(log => log.userId!));
    
    Array.from(users).slice(0, 5).forEach(userId => {
      const userLogs = logs.filter(log => log.userId === userId);
      
      if (userLogs.length > 10) {
        const baseline = calculateBehaviorBaseline(userLogs.slice(0, Math.floor(userLogs.length * 0.7)));
        const current = calculateCurrentBehavior(userLogs.slice(Math.floor(userLogs.length * 0.7)));
        const deviations = calculateDeviations(baseline, current);
        
        userProfiles.push({
          id: `user_${userId}`,
          name: `User ${userId}`,
          type: 'user',
          baseline,
          currentBehavior: current,
          deviations,
          confidence: Math.random() * 25 + 75,
          lastUpdated: new Date()
        });
      }
    });
    
    return userProfiles;
  };

  const generateApplicationProfiles = (logs: LogEntry[]): BehaviorProfile[] => {
    const appProfiles: BehaviorProfile[] = [];
    const sources = new Set(logs.map(log => log.source));
    
    Array.from(sources).slice(0, 3).forEach(source => {
      const sourceLogs = logs.filter(log => log.source === source);
      
      if (sourceLogs.length > 20) {
        const baseline = calculateBehaviorBaseline(sourceLogs.slice(0, Math.floor(sourceLogs.length * 0.7)));
        const current = calculateCurrentBehavior(sourceLogs.slice(Math.floor(sourceLogs.length * 0.7)));
        const deviations = calculateDeviations(baseline, current);
        
        appProfiles.push({
          id: `app_${source}`,
          name: `${source} Application`,
          type: 'application',
          baseline,
          currentBehavior: current,
          deviations,
          confidence: Math.random() * 20 + 80,
          lastUpdated: new Date()
        });
      }
    });
    
    return appProfiles;
  };

  const generateLearningInsights = (): LearningInsight[] => {
    const insights: LearningInsight[] = [
      {
        id: 'insight_1',
        type: 'pattern',
        title: 'New Error Pattern Detected',
        description: 'A new recurring error pattern has been identified in the authentication service during peak hours.',
        confidence: 87,
        impact: 'high',
        recommendation: 'Investigate authentication service capacity during 9-11 AM timeframe',
        evidence: ['15 similar errors in 2 hours', 'Pattern correlates with user login spikes', 'No previous occurrence in baseline'],
        timestamp: new Date()
      },
      {
        id: 'insight_2',
        type: 'anomaly',
        title: 'Unusual Database Activity',
        description: 'Database query patterns show 300% increase in complex joins during off-peak hours.',
        confidence: 92,
        impact: 'medium',
        recommendation: 'Review scheduled jobs and optimize database queries',
        evidence: ['Query complexity increased', 'Off-peak timing unusual', 'Resource utilization spike'],
        timestamp: subHours(new Date(), 2)
      },
      {
        id: 'insight_3',
        type: 'trend',
        title: 'Gradual Performance Degradation',
        description: 'System response times have been gradually increasing over the past 5 days.',
        confidence: 78,
        impact: 'medium',
        recommendation: 'Schedule performance analysis and potential system maintenance',
        evidence: ['5-day upward trend', 'Multiple services affected', 'Memory usage correlation'],
        timestamp: subHours(new Date(), 6)
      },
      {
        id: 'insight_4',
        type: 'correlation',
        title: 'Error Correlation Discovery',
        description: 'Strong correlation found between network timeouts and subsequent authentication failures.',
        confidence: 94,
        impact: 'high',
        recommendation: 'Implement network timeout handling in authentication flow',
        evidence: ['95% correlation coefficient', 'Consistent 30-second delay pattern', 'Affects 3 different services'],
        timestamp: subHours(new Date(), 12)
      }
    ];
    
    return insights.sort((a, b) => b.confidence - a.confidence);
  };

  const getProfileTypeIcon = (type: string) => {
    switch (type) {
      case 'user': return Users;
      case 'system': return Activity;
      case 'application': return Target;
      case 'network': return TrendingUp;
      default: return Brain;
    }
  };

  const getProfileTypeColor = (type: string) => {
    switch (type) {
      case 'user': return 'text-blue-400 bg-blue-500/10';
      case 'system': return 'text-green-400 bg-green-500/10';
      case 'application': return 'text-purple-400 bg-purple-500/10';
      case 'network': return 'text-orange-400 bg-orange-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

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
                <h2 className="text-2xl font-bold text-white">Behavioral Learning Engine</h2>
                <p className="text-slate-400">AI-powered behavioral analysis and pattern learning</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {lastAnalysisTime && (
                <div className="text-right">
                  <div className="text-slate-400 text-sm">Last Analysis</div>
                  <div className="text-white text-sm">{format(lastAnalysisTime, 'MMM dd, HH:mm')}</div>
                </div>
              )}
              <button
                onClick={handleManualAnalysis}
                disabled={isLearning}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors"
              >
                <Zap className={`h-4 w-4 ${isLearning ? 'animate-spin' : ''}`} />
                <span>{isLearning ? 'Learning...' : 'Run Analysis'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Learning Progress */}
          {isLearning && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 text-sm">Learning behavioral patterns...</span>
                <span className="text-purple-400 text-sm">{Math.round(learningProgress)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${learningProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex h-[calc(95vh-180px)]">
          {/* Behavior Profiles */}
          <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Behavior Profiles</h3>
            
            {!hasInitialData && !isLearning ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h4 className="text-white font-medium mb-2">No Analysis Data</h4>
                <p className="text-slate-400 mb-4">Run behavioral analysis to discover patterns and insights</p>
                <button
                  onClick={handleManualAnalysis}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Start Learning
                </button>
              </div>
            ) : isLearning ? (
              <div className="text-center py-12">
                <Brain className="h-12 w-12 text-purple-400 mx-auto mb-4 animate-pulse" />
                <p className="text-slate-400">Analyzing behavioral patterns...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {behaviorProfiles.map(profile => {
                  const Icon = getProfileTypeIcon(profile.type);
                  
                  return (
                    <div 
                      key={profile.id} 
                      className={`bg-slate-900 border border-slate-600 rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedProfile?.id === profile.id ? 'border-purple-500' : 'hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedProfile(profile)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`p-1 rounded ${getProfileTypeColor(profile.type)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium text-sm">{profile.name}</h4>
                            <p className="text-slate-400 text-xs capitalize">{profile.type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-purple-400 font-bold text-sm">
                            {profile.confidence.toFixed(0)}%
                          </div>
                          <div className="text-slate-400 text-xs">confidence</div>
                        </div>
                      </div>
                      
                      {profile.deviations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {profile.deviations.slice(0, 2).map((deviation, index) => (
                            <span key={index} className={`px-2 py-1 rounded text-xs border ${getSeverityColor(deviation.severity)}`}>
                              {deviation.metric}
                            </span>
                          ))}
                          {profile.deviations.length > 2 && (
                            <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                              +{profile.deviations.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="text-slate-400 text-xs">
                        Updated: {format(profile.lastUpdated, 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Profile Details */}
          <div className="w-1/3 border-r border-slate-700 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Profile Analysis</h3>
            
            {selectedProfile ? (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">{selectedProfile.name}</h4>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-slate-400 text-sm">Baseline Logs/Hour</div>
                      <div className="text-white font-medium">{selectedProfile.baseline.avgLogsPerHour.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">Current Logs/Hour</div>
                      <div className="text-white font-medium">{selectedProfile.currentBehavior.logsPerHour.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">Baseline Error Rate</div>
                      <div className="text-white font-medium">{(selectedProfile.baseline.errorRate * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-sm">Current Error Rate</div>
                      <div className="text-white font-medium">{(selectedProfile.currentBehavior.errorRate * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  
                  {selectedProfile.deviations.length > 0 && (
                    <div>
                      <div className="text-slate-400 text-sm mb-2">Behavioral Deviations</div>
                      <div className="space-y-2">
                        {selectedProfile.deviations.map((deviation, index) => (
                          <div key={index} className={`p-2 rounded border ${getSeverityColor(deviation.severity)}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{deviation.metric}</span>
                              <span className="text-xs capitalize">{deviation.severity}</span>
                            </div>
                            <div className="text-xs">
                              Deviation: {(deviation.deviation * 100).toFixed(1)}% • Trend: {deviation.trend}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                  <h5 className="text-white font-medium mb-3">Pattern Analysis</h5>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Common Sources</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedProfile.baseline.commonSources.map((source, index) => (
                          <span key={index} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-slate-400 text-sm mb-1">Peak Hours</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedProfile.baseline.peakHours.map((hour, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {hour}:00
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">Select a behavior profile to view detailed analysis</p>
              </div>
            )}
          </div>

          {/* Learning Insights */}
          <div className="w-1/3 p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Learning Insights</h3>
            
            {learningInsights.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-400">No insights available yet</p>
                <p className="text-slate-500 text-sm mt-1">Run analysis to generate insights</p>
              </div>
            ) : (
              <div className="space-y-4">
                {learningInsights.map(insight => (
                  <div key={insight.id} className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-white font-medium text-sm">{insight.title}</h4>
                        <p className="text-slate-400 text-xs capitalize">{insight.type}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-400 font-bold text-sm">
                          {insight.confidence}%
                        </div>
                        <div className={`text-xs capitalize ${getImpactColor(insight.impact)}`}>
                          {insight.impact}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-slate-300 text-sm mb-3">{insight.description}</p>
                    
                    <div className="mb-3">
                      <div className="text-slate-400 text-xs mb-1">Recommendation:</div>
                      <p className="text-blue-400 text-sm">{insight.recommendation}</p>
                    </div>
                    
                    <div className="mb-3">
                      <div className="text-slate-400 text-xs mb-1">Evidence:</div>
                      <ul className="space-y-1">
                        {insight.evidence.map((evidence, index) => (
                          <li key={index} className="text-slate-300 text-xs flex items-start">
                            <span className="text-green-400 mr-1">•</span>
                            {evidence}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="text-slate-400 text-xs">
                      Discovered: {format(insight.timestamp, 'MMM dd, HH:mm')}
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