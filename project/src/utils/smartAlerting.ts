import { LogEntry, MLAnomaly, Site } from '../types';
import { subHours, subMinutes, isAfter, differenceInMinutes } from 'date-fns';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: AlertCondition[];
  suppressionRules: SuppressionRule[];
  escalationRules: EscalationRule[];
  contextualInfo: ContextualInfo;
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'log_count' | 'error_rate' | 'anomaly_score' | 'health_score';
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  timeWindow: number; // minutes
  siteIds?: string[];
  severityLevels?: string[];
}

export interface SuppressionRule {
  type: 'duplicate' | 'flood' | 'maintenance' | 'dependency';
  timeWindow: number; // minutes
  maxAlerts: number;
  conditions: any;
}

export interface EscalationRule {
  level: number;
  delayMinutes: number;
  recipients: string[];
  channels: ('email' | 'slack' | 'teams' | 'sms' | 'webhook')[];
  conditions?: any;
}

export interface ContextualInfo {
  runbookUrl?: string;
  troubleshootingSteps: string[];
  relatedDashboards: string[];
  knowledgeBaseArticles: string[];
  automatedActions: AutomatedAction[];
}

export interface AutomatedAction {
  type: 'restart_service' | 'scale_up' | 'clear_cache' | 'run_script';
  description: string;
  script?: string;
  conditions: any;
  enabled: boolean;
}

export interface SmartAlert {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggeredAt: Date;
  events: (LogEntry | MLAnomaly)[];
  affectedSites: string[];
  contextualInfo: ContextualInfo;
  suppressedUntil?: Date;
  escalationLevel: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class SmartAlertingEngine {
  private static alertHistory: SmartAlert[] = [];
  private static suppressedAlerts: Map<string, Date> = new Map();

  /**
   * Process events and generate smart alerts with suppression and grouping
   */
  static processEvents(
    logs: LogEntry[],
    anomalies: MLAnomaly[],
    sites: Site[],
    alertRules: AlertRule[]
  ): SmartAlert[] {
    const newAlerts: SmartAlert[] = [];
    const now = new Date();

    // Clean up old suppression entries
    this.cleanupSuppressions();

    alertRules.filter(rule => rule.enabled).forEach(rule => {
      const triggeredAlert = this.evaluateRule(rule, logs, anomalies, sites);
      
      if (triggeredAlert) {
        // Check if alert should be suppressed
        if (!this.shouldSuppressAlert(triggeredAlert, rule)) {
          // Apply intelligent grouping
          const groupedAlert = this.groupSimilarAlerts(triggeredAlert);
          newAlerts.push(groupedAlert);
          
          // Add to history
          this.alertHistory.push(groupedAlert);
          
          // Update suppression tracking
          this.updateSuppressionTracking(groupedAlert, rule);
        }
      }
    });

    // Clean up old alerts from history
    this.alertHistory = this.alertHistory.filter(alert => 
      isAfter(alert.triggeredAt, subHours(now, 24))
    );

    return newAlerts;
  }

  /**
   * Create escalation workflows with automatic team routing
   */
  static processEscalations(alerts: SmartAlert[], alertRules: AlertRule[]): Array<{
    alert: SmartAlert;
    escalationAction: {
      level: number;
      recipients: string[];
      channels: string[];
      message: string;
    };
  }> {
    const escalations = [];
    const now = new Date();

    alerts.forEach(alert => {
      if (alert.acknowledged || alert.resolved) return;

      const rule = alertRules.find(r => r.id === alert.ruleId);
      if (!rule) return;

      const minutesSinceTriggered = differenceInMinutes(now, alert.triggeredAt);
      
      // Find applicable escalation rule
      const applicableEscalation = rule.escalationRules
        .filter(esc => minutesSinceTriggered >= esc.delayMinutes)
        .sort((a, b) => b.level - a.level)[0]; // Get highest applicable level

      if (applicableEscalation && applicableEscalation.level > alert.escalationLevel) {
        escalations.push({
          alert,
          escalationAction: {
            level: applicableEscalation.level,
            recipients: applicableEscalation.recipients,
            channels: applicableEscalation.channels,
            message: this.generateEscalationMessage(alert, applicableEscalation)
          }
        });

        // Update alert escalation level
        alert.escalationLevel = applicableEscalation.level;
      }
    });

    return escalations;
  }

  /**
   * Generate context-aware notifications with troubleshooting steps
   */
  static generateContextualNotification(alert: SmartAlert): {
    title: string;
    message: string;
    troubleshootingSteps: string[];
    runbookLinks: string[];
    dashboardLinks: string[];
    automatedActions: string[];
  } {
    const context = alert.contextualInfo;
    
    return {
      title: `${alert.severity.toUpperCase()}: ${alert.title}`,
      message: this.generateDetailedMessage(alert),
      troubleshootingSteps: context.troubleshootingSteps,
      runbookLinks: context.runbookUrl ? [context.runbookUrl] : [],
      dashboardLinks: context.relatedDashboards,
      automatedActions: context.automatedActions
        .filter(action => action.enabled)
        .map(action => action.description)
    };
  }

  /**
   * Prevent alert fatigue through intelligent suppression
   */
  static configureAlertFatiguePrevention(): {
    duplicateSuppressionWindow: number;
    floodProtectionThreshold: number;
    adaptiveThresholds: boolean;
    quietHours: { start: string; end: string };
    maintenanceWindows: Array<{ start: Date; end: Date; description: string }>;
  } {
    return {
      duplicateSuppressionWindow: 30, // minutes
      floodProtectionThreshold: 10, // max alerts per 5 minutes
      adaptiveThresholds: true,
      quietHours: { start: '22:00', end: '06:00' },
      maintenanceWindows: this.getMaintenanceWindows()
    };
  }

  private static evaluateRule(
    rule: AlertRule,
    logs: LogEntry[],
    anomalies: MLAnomaly[],
    sites: Site[]
  ): SmartAlert | null {
    const now = new Date();
    let triggered = false;
    const triggeringEvents: (LogEntry | MLAnomaly)[] = [];
    const affectedSites: string[] = [];

    // Evaluate each condition
    rule.conditions.forEach(condition => {
      const conditionResult = this.evaluateCondition(condition, logs, anomalies, sites);
      if (conditionResult.triggered) {
        triggered = true;
        triggeringEvents.push(...conditionResult.events);
        affectedSites.push(...conditionResult.affectedSites);
      }
    });

    if (!triggered) return null;

    // Determine severity based on conditions and events
    const severity = this.calculateAlertSeverity(triggeringEvents, rule);

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      title: rule.name,
      description: this.generateAlertDescription(rule, triggeringEvents),
      severity,
      triggeredAt: now,
      events: triggeringEvents,
      affectedSites: [...new Set(affectedSites)],
      contextualInfo: rule.contextualInfo,
      escalationLevel: 0,
      acknowledged: false,
      resolved: false
    };
  }

  private static evaluateCondition(
    condition: AlertCondition,
    logs: LogEntry[],
    anomalies: MLAnomaly[],
    sites: Site[]
  ): { triggered: boolean; events: (LogEntry | MLAnomaly)[]; affectedSites: string[] } {
    const now = new Date();
    const windowStart = subMinutes(now, condition.timeWindow);
    
    let triggered = false;
    let events: (LogEntry | MLAnomaly)[] = [];
    let affectedSites: string[] = [];

    switch (condition.type) {
      case 'log_count':
        const relevantLogs = logs.filter(log => 
          isAfter(log.timestamp, windowStart) &&
          (!condition.siteIds || condition.siteIds.includes(log.siteId)) &&
          (!condition.severityLevels || condition.severityLevels.includes(log.level))
        );
        
        triggered = this.compareValue(relevantLogs.length, condition.operator, condition.threshold);
        if (triggered) {
          events = relevantLogs;
          affectedSites = [...new Set(relevantLogs.map(log => log.siteId))];
        }
        break;

      case 'error_rate':
        const windowLogs = logs.filter(log => isAfter(log.timestamp, windowStart));
        const errorLogs = windowLogs.filter(log => ['critical', 'high'].includes(log.level));
        const errorRate = windowLogs.length > 0 ? errorLogs.length / windowLogs.length : 0;
        
        triggered = this.compareValue(errorRate, condition.operator, condition.threshold);
        if (triggered) {
          events = errorLogs;
          affectedSites = [...new Set(errorLogs.map(log => log.siteId))];
        }
        break;

      case 'anomaly_score':
        const relevantAnomalies = anomalies.filter(anomaly => 
          isAfter(anomaly.timestamp, windowStart) &&
          (!condition.siteIds || condition.siteIds.includes(anomaly.siteId)) &&
          (!condition.severityLevels || condition.severityLevels.includes(anomaly.severity))
        );
        
        const maxScore = Math.max(...relevantAnomalies.map(a => a.score), 0);
        triggered = this.compareValue(maxScore, condition.operator, condition.threshold);
        if (triggered) {
          events = relevantAnomalies.filter(a => a.score >= condition.threshold);
          affectedSites = [...new Set(events.map(e => e.siteId))];
        }
        break;

      case 'health_score':
        const relevantSites = sites.filter(site => 
          !condition.siteIds || condition.siteIds.includes(site.id)
        );
        
        const unhealthySites = relevantSites.filter(site => 
          this.compareValue(site.healthScore, condition.operator, condition.threshold)
        );
        
        triggered = unhealthySites.length > 0;
        if (triggered) {
          affectedSites = unhealthySites.map(site => site.id);
          // Get recent logs for these sites as evidence
          events = logs.filter(log => 
            affectedSites.includes(log.siteId) && 
            isAfter(log.timestamp, windowStart)
          );
        }
        break;
    }

    return { triggered, events, affectedSites };
  }

  private static compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '=': return value === threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      default: return false;
    }
  }

  private static shouldSuppressAlert(alert: SmartAlert, rule: AlertRule): boolean {
    const now = new Date();

    // Check each suppression rule
    return rule.suppressionRules.some(suppression => {
      switch (suppression.type) {
        case 'duplicate':
          return this.isDuplicateAlert(alert, suppression);
        case 'flood':
          return this.isFloodingAlert(alert, suppression);
        case 'maintenance':
          return this.isMaintenanceWindow(now);
        case 'dependency':
          return this.isDependencyAlert(alert, suppression);
        default:
          return false;
      }
    });
  }

  private static isDuplicateAlert(alert: SmartAlert, suppression: SuppressionRule): boolean {
    const windowStart = subMinutes(alert.triggeredAt, suppression.timeWindow);
    
    const recentSimilarAlerts = this.alertHistory.filter(histAlert => 
      histAlert.ruleId === alert.ruleId &&
      isAfter(histAlert.triggeredAt, windowStart) &&
      this.alertsAreSimilar(alert, histAlert)
    );

    return recentSimilarAlerts.length >= suppression.maxAlerts;
  }

  private static isFloodingAlert(alert: SmartAlert, suppression: SuppressionRule): boolean {
    const windowStart = subMinutes(alert.triggeredAt, suppression.timeWindow);
    
    const recentAlerts = this.alertHistory.filter(histAlert => 
      isAfter(histAlert.triggeredAt, windowStart)
    );

    return recentAlerts.length >= suppression.maxAlerts;
  }

  private static isMaintenanceWindow(time: Date): boolean {
    const maintenanceWindows = this.getMaintenanceWindows();
    return maintenanceWindows.some(window => 
      time >= window.start && time <= window.end
    );
  }

  private static isDependencyAlert(alert: SmartAlert, suppression: SuppressionRule): boolean {
    // Check if there are upstream alerts that could be causing this one
    const windowStart = subMinutes(alert.triggeredAt, suppression.timeWindow);
    
    const upstreamAlerts = this.alertHistory.filter(histAlert => 
      isAfter(histAlert.triggeredAt, windowStart) &&
      histAlert.severity === 'critical' &&
      this.isUpstreamDependency(histAlert, alert)
    );

    return upstreamAlerts.length > 0;
  }

  private static alertsAreSimilar(alert1: SmartAlert, alert2: SmartAlert): boolean {
    // Check if alerts are similar based on affected sites and event types
    const sites1 = new Set(alert1.affectedSites);
    const sites2 = new Set(alert2.affectedSites);
    const siteOverlap = [...sites1].filter(site => sites2.has(site)).length;
    
    return siteOverlap > 0 && alert1.severity === alert2.severity;
  }

  private static isUpstreamDependency(upstreamAlert: SmartAlert, downstreamAlert: SmartAlert): boolean {
    // Simple heuristic: if upstream alert affects infrastructure components
    // and downstream alert affects application components
    const infrastructureKeywords = ['database', 'network', 'storage', 'auth'];
    const upstreamDesc = upstreamAlert.description.toLowerCase();
    
    return infrastructureKeywords.some(keyword => upstreamDesc.includes(keyword));
  }

  private static groupSimilarAlerts(alert: SmartAlert): SmartAlert {
    // Find recent similar alerts and group them
    const windowStart = subMinutes(alert.triggeredAt, 10); // 10-minute grouping window
    
    const similarAlerts = this.alertHistory.filter(histAlert => 
      histAlert.ruleId === alert.ruleId &&
      isAfter(histAlert.triggeredAt, windowStart) &&
      this.alertsAreSimilar(alert, histAlert)
    );

    if (similarAlerts.length > 0) {
      // Merge events and affected sites
      const allEvents = [...alert.events];
      const allSites = new Set(alert.affectedSites);
      
      similarAlerts.forEach(simAlert => {
        allEvents.push(...simAlert.events);
        simAlert.affectedSites.forEach(site => allSites.add(site));
      });

      alert.events = allEvents;
      alert.affectedSites = Array.from(allSites);
      alert.description += ` (grouped with ${similarAlerts.length} similar alerts)`;
    }

    return alert;
  }

  private static calculateAlertSeverity(
    events: (LogEntry | MLAnomaly)[],
    rule: AlertRule
  ): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = events.filter(event => 
      ('level' in event && event.level === 'critical') ||
      ('severity' in event && event.severity === 'critical')
    ).length;

    const highEvents = events.filter(event => 
      ('level' in event && event.level === 'high') ||
      ('severity' in event && event.severity === 'high')
    ).length;

    if (criticalEvents > 0) return 'critical';
    if (highEvents > 2) return 'high';
    if (highEvents > 0 || events.length > 10) return 'medium';
    return 'low';
  }

  private static generateAlertDescription(rule: AlertRule, events: (LogEntry | MLAnomaly)[]): string {
    const eventCount = events.length;
    const affectedSites = new Set(events.map(event => event.siteId)).size;
    
    return `${rule.description} - ${eventCount} events detected across ${affectedSites} site(s)`;
  }

  private static generateEscalationMessage(alert: SmartAlert, escalation: EscalationRule): string {
    return `ESCALATION LEVEL ${escalation.level}: ${alert.title}\n\n` +
           `Alert has been unacknowledged for ${differenceInMinutes(new Date(), alert.triggeredAt)} minutes.\n` +
           `Affected sites: ${alert.affectedSites.join(', ')}\n` +
           `Severity: ${alert.severity.toUpperCase()}\n\n` +
           `Please investigate immediately.`;
  }

  private static generateDetailedMessage(alert: SmartAlert): string {
    const eventSummary = this.summarizeEvents(alert.events);
    
    return `${alert.description}\n\n` +
           `Event Summary:\n${eventSummary}\n\n` +
           `Affected Sites: ${alert.affectedSites.join(', ')}\n` +
           `Triggered: ${alert.triggeredAt.toISOString()}\n` +
           `Escalation Level: ${alert.escalationLevel}`;
  }

  private static summarizeEvents(events: (LogEntry | MLAnomaly)[]): string {
    const logEvents = events.filter(e => 'message' in e) as LogEntry[];
    const anomalyEvents = events.filter(e => 'description' in e) as MLAnomaly[];
    
    let summary = '';
    
    if (logEvents.length > 0) {
      summary += `• ${logEvents.length} log entries\n`;
      const errorCodes = new Set(logEvents.filter(log => log.errorCode).map(log => log.errorCode));
      if (errorCodes.size > 0) {
        summary += `• Error codes: ${Array.from(errorCodes).join(', ')}\n`;
      }
    }
    
    if (anomalyEvents.length > 0) {
      summary += `• ${anomalyEvents.length} ML anomalies detected\n`;
      const avgScore = anomalyEvents.reduce((sum, a) => sum + a.score, 0) / anomalyEvents.length;
      summary += `• Average anomaly score: ${avgScore.toFixed(1)}\n`;
    }
    
    return summary;
  }

  private static cleanupSuppressions(): void {
    const now = new Date();
    for (const [key, suppressedUntil] of this.suppressedAlerts.entries()) {
      if (now > suppressedUntil) {
        this.suppressedAlerts.delete(key);
      }
    }
  }

  private static updateSuppressionTracking(alert: SmartAlert, rule: AlertRule): void {
    rule.suppressionRules.forEach(suppression => {
      if (suppression.type === 'duplicate') {
        const suppressionKey = `${alert.ruleId}_${alert.affectedSites.join('_')}`;
        const suppressUntil = new Date(alert.triggeredAt.getTime() + (suppression.timeWindow * 60000));
        this.suppressedAlerts.set(suppressionKey, suppressUntil);
      }
    });
  }

  private static getMaintenanceWindows(): Array<{ start: Date; end: Date; description: string }> {
    // This would typically come from a configuration system
    return [
      // Example maintenance windows
    ];
  }
}