import { LogEntry, MLAnomaly, Site } from '../types';
import { isAfter, subHours, subMinutes } from 'date-fns';

export interface RootCauseResult {
  id: string;
  primaryEvent: LogEntry | MLAnomaly;
  relatedEvents: (LogEntry | MLAnomaly)[];
  correlationScore: number;
  rootCause: string;
  impactedSites: string[];
  timeline: TimelineEvent[];
  recommendedActions: string[];
  confidence: number;
}

export interface TimelineEvent {
  timestamp: Date;
  event: LogEntry | MLAnomaly;
  eventType: 'log' | 'anomaly';
  impact: 'trigger' | 'cascade' | 'symptom';
  description: string;
}

export interface CorrelationPattern {
  pattern: string;
  events: (LogEntry | MLAnomaly)[];
  strength: number;
  timeWindow: number; // minutes
  description: string;
}

export class RootCauseAnalyzer {
  private static readonly CORRELATION_THRESHOLD = 0.7;
  private static readonly TIME_WINDOW_MINUTES = 30;
  private static readonly MAX_RELATED_EVENTS = 20;

  /**
   * Analyze root causes by correlating events across sites
   */
  static analyzeRootCause(
    primaryEvent: LogEntry | MLAnomaly,
    allLogs: LogEntry[],
    allAnomalies: MLAnomaly[],
    sites: Site[]
  ): RootCauseResult {
    const timeWindow = subMinutes(primaryEvent.timestamp, this.TIME_WINDOW_MINUTES);
    const endWindow = new Date(primaryEvent.timestamp.getTime() + (this.TIME_WINDOW_MINUTES * 60000));

    // Find related events in time window
    const relatedLogs = allLogs.filter(log => 
      log.id !== primaryEvent.id &&
      log.timestamp >= timeWindow &&
      log.timestamp <= endWindow
    );

    const relatedAnomalies = allAnomalies.filter(anomaly => 
      anomaly.id !== primaryEvent.id &&
      anomaly.timestamp >= timeWindow &&
      anomaly.timestamp <= endWindow
    );

    // Combine and analyze correlations
    const allRelatedEvents = [...relatedLogs, ...relatedAnomalies];
    const correlatedEvents = this.findCorrelatedEvents(primaryEvent, allRelatedEvents);
    
    // Build timeline
    const timeline = this.buildTimeline(primaryEvent, correlatedEvents);
    
    // Determine root cause
    const rootCause = this.determineRootCause(primaryEvent, correlatedEvents, timeline);
    
    // Calculate impact
    const impactedSites = this.getImpactedSites(primaryEvent, correlatedEvents);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(rootCause, correlatedEvents);

    return {
      id: `rca_${Date.now()}`,
      primaryEvent,
      relatedEvents: correlatedEvents,
      correlationScore: this.calculateOverallCorrelation(correlatedEvents),
      rootCause: rootCause.description,
      impactedSites,
      timeline,
      recommendedActions: recommendations,
      confidence: rootCause.confidence
    };
  }

  /**
   * Find behavioral baselines and detect deviations
   */
  static analyzeBehavioralBaselines(
    site: Site,
    logs: LogEntry[],
    timeWindowHours: number = 24
  ): {
    baseline: any;
    currentBehavior: any;
    deviations: Array<{
      metric: string;
      baseline: number;
      current: number;
      deviation: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  } {
    const now = new Date();
    const windowStart = subHours(now, timeWindowHours);
    
    // Get historical baseline (last 7 days, excluding current window)
    const baselineStart = subHours(windowStart, 24 * 7);
    const baselineLogs = logs.filter(log => 
      log.siteId === site.id &&
      log.timestamp >= baselineStart &&
      log.timestamp < windowStart
    );

    // Get current behavior
    const currentLogs = logs.filter(log => 
      log.siteId === site.id &&
      log.timestamp >= windowStart
    );

    const baseline = this.calculateBehaviorMetrics(baselineLogs);
    const currentBehavior = this.calculateBehaviorMetrics(currentLogs);
    
    const deviations = this.detectDeviations(baseline, currentBehavior);

    return {
      baseline,
      currentBehavior,
      deviations
    };
  }

  /**
   * Group similar anomalies to identify systemic issues
   */
  static clusterAnomalies(anomalies: MLAnomaly[]): Array<{
    clusterId: string;
    anomalies: MLAnomaly[];
    pattern: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedSites: string[];
    timeSpan: { start: Date; end: Date };
    recommendedActions: string[];
  }> {
    const clusters = new Map<string, MLAnomaly[]>();
    
    // Group by similarity
    anomalies.forEach(anomaly => {
      const clusterKey = this.generateClusterKey(anomaly);
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(anomaly);
    });

    return Array.from(clusters.entries())
      .filter(([_, anomalies]) => anomalies.length > 1) // Only clusters with multiple anomalies
      .map(([pattern, clusterAnomalies]) => {
        const sortedAnomalies = clusterAnomalies.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const severity = this.calculateClusterSeverity(clusterAnomalies);
        
        return {
          clusterId: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          anomalies: clusterAnomalies,
          pattern,
          severity,
          description: this.generateClusterDescription(pattern, clusterAnomalies),
          affectedSites: [...new Set(clusterAnomalies.map(a => a.siteId))],
          timeSpan: {
            start: sortedAnomalies[0].timestamp,
            end: sortedAnomalies[sortedAnomalies.length - 1].timestamp
          },
          recommendedActions: this.generateClusterRecommendations(pattern, severity)
        };
      })
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
  }

  private static findCorrelatedEvents(
    primaryEvent: LogEntry | MLAnomaly,
    candidateEvents: (LogEntry | MLAnomaly)[]
  ): (LogEntry | MLAnomaly)[] {
    const correlatedEvents: Array<{ event: LogEntry | MLAnomaly; score: number }> = [];

    candidateEvents.forEach(event => {
      const correlationScore = this.calculateCorrelationScore(primaryEvent, event);
      if (correlationScore > this.CORRELATION_THRESHOLD) {
        correlatedEvents.push({ event, score: correlationScore });
      }
    });

    return correlatedEvents
      .sort((a, b) => b.score - a.score)
      .slice(0, this.MAX_RELATED_EVENTS)
      .map(item => item.event);
  }

  private static calculateCorrelationScore(
    event1: LogEntry | MLAnomaly,
    event2: LogEntry | MLAnomaly
  ): number {
    let score = 0;

    // Time proximity (closer in time = higher correlation)
    const timeDiff = Math.abs(event1.timestamp.getTime() - event2.timestamp.getTime());
    const timeScore = Math.max(0, 1 - (timeDiff / (this.TIME_WINDOW_MINUTES * 60000)));
    score += timeScore * 0.3;

    // Site correlation (same site = higher correlation)
    if (event1.siteId === event2.siteId) {
      score += 0.4;
    }

    // Severity correlation
    const severity1 = this.getSeverityWeight('level' in event1 ? event1.level : event1.severity);
    const severity2 = this.getSeverityWeight('level' in event2 ? event2.level : event2.severity);
    const severityScore = 1 - Math.abs(severity1 - severity2) / 3;
    score += severityScore * 0.2;

    // Content similarity (for logs)
    if ('message' in event1 && 'message' in event2) {
      const contentScore = this.calculateContentSimilarity(event1.message, event2.message);
      score += contentScore * 0.1;
    }

    return Math.min(1, score);
  }

  private static getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 3;
      case 'high': return 2;
      case 'medium': return 1;
      case 'low': return 0;
      default: return 0;
    }
  }

  private static calculateContentSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private static buildTimeline(
    primaryEvent: LogEntry | MLAnomaly,
    relatedEvents: (LogEntry | MLAnomaly)[]
  ): TimelineEvent[] {
    const allEvents = [primaryEvent, ...relatedEvents];
    const sortedEvents = allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return sortedEvents.map((event, index) => {
      const impact = index === 0 ? 'trigger' : 
                    index < sortedEvents.length / 2 ? 'cascade' : 'symptom';
      
      return {
        timestamp: event.timestamp,
        event,
        eventType: 'message' in event ? 'log' : 'anomaly',
        impact,
        description: this.generateTimelineDescription(event, impact)
      };
    });
  }

  private static generateTimelineDescription(
    event: LogEntry | MLAnomaly,
    impact: 'trigger' | 'cascade' | 'symptom'
  ): string {
    const eventDesc = 'message' in event ? event.message : event.description;
    const impactDesc = {
      trigger: 'Initial trigger event',
      cascade: 'Cascading effect',
      symptom: 'Resulting symptom'
    }[impact];
    
    return `${impactDesc}: ${eventDesc}`;
  }

  private static determineRootCause(
    primaryEvent: LogEntry | MLAnomaly,
    relatedEvents: (LogEntry | MLAnomaly)[],
    timeline: TimelineEvent[]
  ): { description: string; confidence: number } {
    // Analyze patterns to determine root cause
    const errorPatterns = this.analyzeErrorPatterns(relatedEvents);
    const systemPatterns = this.analyzeSystemPatterns(relatedEvents);
    const networkPatterns = this.analyzeNetworkPatterns(relatedEvents);
    
    let rootCause = 'Unknown system issue';
    let confidence = 0.5;

    if (errorPatterns.databaseErrors > 2) {
      rootCause = 'Database connectivity or performance issue';
      confidence = 0.8;
    } else if (systemPatterns.memoryIssues > 1) {
      rootCause = 'System resource exhaustion (memory)';
      confidence = 0.75;
    } else if (networkPatterns.networkErrors > 1) {
      rootCause = 'Network connectivity issue';
      confidence = 0.7;
    } else if (errorPatterns.authErrors > 2) {
      rootCause = 'Authentication service failure';
      confidence = 0.8;
    }

    return { description: rootCause, confidence };
  }

  private static analyzeErrorPatterns(events: (LogEntry | MLAnomaly)[]): any {
    const patterns = {
      databaseErrors: 0,
      authErrors: 0,
      apiErrors: 0
    };

    events.forEach(event => {
      if ('errorCode' in event && event.errorCode) {
        if (event.errorCode.startsWith('DB_')) patterns.databaseErrors++;
        if (event.errorCode.startsWith('AUTH_')) patterns.authErrors++;
        if (event.errorCode.startsWith('API_')) patterns.apiErrors++;
      }
      
      if ('message' in event) {
        const message = event.message.toLowerCase();
        if (message.includes('database') || message.includes('connection')) patterns.databaseErrors++;
        if (message.includes('auth') || message.includes('login')) patterns.authErrors++;
        if (message.includes('api') || message.includes('endpoint')) patterns.apiErrors++;
      }
    });

    return patterns;
  }

  private static analyzeSystemPatterns(events: (LogEntry | MLAnomaly)[]): any {
    const patterns = {
      memoryIssues: 0,
      diskIssues: 0,
      cpuIssues: 0
    };

    events.forEach(event => {
      if ('message' in event) {
        const message = event.message.toLowerCase();
        if (message.includes('memory') || message.includes('heap')) patterns.memoryIssues++;
        if (message.includes('disk') || message.includes('storage')) patterns.diskIssues++;
        if (message.includes('cpu') || message.includes('processor')) patterns.cpuIssues++;
      }
    });

    return patterns;
  }

  private static analyzeNetworkPatterns(events: (LogEntry | MLAnomaly)[]): any {
    const patterns = {
      networkErrors: 0,
      timeouts: 0,
      connectionIssues: 0
    };

    events.forEach(event => {
      if ('message' in event) {
        const message = event.message.toLowerCase();
        if (message.includes('network') || message.includes('connection')) patterns.networkErrors++;
        if (message.includes('timeout') || message.includes('timed out')) patterns.timeouts++;
        if (message.includes('refused') || message.includes('unreachable')) patterns.connectionIssues++;
      }
    });

    return patterns;
  }

  private static getImpactedSites(
    primaryEvent: LogEntry | MLAnomaly,
    relatedEvents: (LogEntry | MLAnomaly)[]
  ): string[] {
    const siteIds = new Set<string>();
    siteIds.add(primaryEvent.siteId);
    
    relatedEvents.forEach(event => {
      siteIds.add(event.siteId);
    });
    
    return Array.from(siteIds);
  }

  private static generateRecommendations(
    rootCause: { description: string; confidence: number },
    events: (LogEntry | MLAnomaly)[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (rootCause.description.includes('database')) {
      recommendations.push(
        'Check database connection pool settings',
        'Verify database server health',
        'Review recent database schema changes',
        'Monitor database query performance'
      );
    } else if (rootCause.description.includes('memory')) {
      recommendations.push(
        'Check application memory usage',
        'Review garbage collection logs',
        'Analyze memory leak patterns',
        'Consider increasing heap size'
      );
    } else if (rootCause.description.includes('network')) {
      recommendations.push(
        'Verify network connectivity between services',
        'Check firewall rules and security groups',
        'Monitor network latency and packet loss',
        'Review load balancer configuration'
      );
    } else if (rootCause.description.includes('authentication')) {
      recommendations.push(
        'Check authentication service status',
        'Verify token expiration settings',
        'Review user session management',
        'Check identity provider connectivity'
      );
    }
    
    // Add general recommendations
    recommendations.push(
      'Review recent deployments and changes',
      'Check system resource utilization',
      'Verify monitoring and alerting configuration'
    );
    
    return recommendations;
  }

  private static calculateOverallCorrelation(events: (LogEntry | MLAnomaly)[]): number {
    if (events.length === 0) return 0;
    
    // Calculate average correlation between all events
    let totalCorrelation = 0;
    let comparisons = 0;
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        totalCorrelation += this.calculateCorrelationScore(events[i], events[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalCorrelation / comparisons : 0;
  }

  private static calculateBehaviorMetrics(logs: LogEntry[]): any {
    return {
      totalLogs: logs.length,
      errorRate: logs.filter(log => ['critical', 'high'].includes(log.level)).length / Math.max(logs.length, 1),
      avgLogsPerHour: logs.length / 24,
      uniqueSources: new Set(logs.map(log => log.source)).size,
      uniqueErrorCodes: new Set(logs.filter(log => log.errorCode).map(log => log.errorCode)).size,
      peakHour: this.findPeakHour(logs)
    };
  }

  private static findPeakHour(logs: LogEntry[]): number {
    const hourCounts = new Array(24).fill(0);
    logs.forEach(log => {
      hourCounts[log.timestamp.getHours()]++;
    });
    
    return hourCounts.indexOf(Math.max(...hourCounts));
  }

  private static detectDeviations(baseline: any, current: any): any[] {
    const deviations = [];
    
    // Check error rate deviation
    const errorRateDeviation = Math.abs(current.errorRate - baseline.errorRate) / Math.max(baseline.errorRate, 0.01);
    if (errorRateDeviation > 0.5) {
      deviations.push({
        metric: 'Error Rate',
        baseline: baseline.errorRate,
        current: current.errorRate,
        deviation: errorRateDeviation,
        severity: errorRateDeviation > 2 ? 'critical' : errorRateDeviation > 1 ? 'high' : 'medium'
      });
    }
    
    // Check log volume deviation
    const volumeDeviation = Math.abs(current.avgLogsPerHour - baseline.avgLogsPerHour) / Math.max(baseline.avgLogsPerHour, 1);
    if (volumeDeviation > 0.3) {
      deviations.push({
        metric: 'Log Volume',
        baseline: baseline.avgLogsPerHour,
        current: current.avgLogsPerHour,
        deviation: volumeDeviation,
        severity: volumeDeviation > 1.5 ? 'critical' : volumeDeviation > 1 ? 'high' : 'medium'
      });
    }
    
    return deviations;
  }

  private static generateClusterKey(anomaly: MLAnomaly): string {
    // Generate a key based on anomaly characteristics
    return `${anomaly.type}_${anomaly.severity}_${Math.floor(anomaly.score / 20) * 20}`;
  }

  private static calculateClusterSeverity(anomalies: MLAnomaly[]): 'low' | 'medium' | 'high' | 'critical' {
    const avgScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    
    if (criticalCount > 2 || avgScore > 80) return 'critical';
    if (criticalCount > 0 || avgScore > 60) return 'high';
    if (avgScore > 40) return 'medium';
    return 'low';
  }

  private static generateClusterDescription(pattern: string, anomalies: MLAnomaly[]): string {
    const [type, severity, scoreRange] = pattern.split('_');
    return `${anomalies.length} ${severity} ${type} anomalies detected with scores around ${scoreRange}`;
  }

  private static generateClusterRecommendations(pattern: string, severity: string): string[] {
    const [type] = pattern.split('_');
    const recommendations = [];
    
    switch (type) {
      case 'pattern':
        recommendations.push('Investigate log pattern changes', 'Review recent system modifications');
        break;
      case 'behavior':
        recommendations.push('Analyze user behavior patterns', 'Check for security incidents');
        break;
      case 'timeseries':
        recommendations.push('Review seasonal patterns', 'Check for capacity issues');
        break;
      case 'threshold':
        recommendations.push('Adjust alerting thresholds', 'Investigate threshold breaches');
        break;
      case 'clustering':
        recommendations.push('Analyze new error patterns', 'Update error handling');
        break;
    }
    
    if (severity === 'critical') {
      recommendations.unshift('Immediate investigation required', 'Alert on-call team');
    }
    
    return recommendations;
  }
}