import { Site, LogEntry, HealthDataPoint } from '../types';
import { subHours, isAfter, differenceInHours } from 'date-fns';

export class HealthCalculator {
  private static readonly HEALTH_WINDOW_HOURS = 24;
  private static readonly MAX_HEALTH_SCORE = 100;
  private static readonly MIN_HEALTH_SCORE = 0;

  /**
   * Calculate health score based on 24-hour rolling window
   */
  static calculateHealthScore(site: Site, recentLogs: LogEntry[]): number {
    const now = new Date();
    const windowStart = subHours(now, this.HEALTH_WINDOW_HOURS);
    
    // Filter logs to 24-hour window
    const windowLogs = recentLogs.filter(log => 
      log.siteId === site.id && isAfter(log.timestamp, windowStart)
    );

    if (windowLogs.length === 0) {
      // No logs in 24 hours - could be good or bad depending on expected activity
      return site.healthScore; // Maintain current score
    }

    // Calculate error rates by severity
    const criticalErrors = windowLogs.filter(log => log.level === 'critical' && !log.acknowledged).length;
    const highErrors = windowLogs.filter(log => log.level === 'high' && !log.acknowledged).length;
    const mediumErrors = windowLogs.filter(log => log.level === 'medium' && !log.acknowledged).length;
    const totalLogs = windowLogs.length;

    // Weight errors by severity
    const errorScore = (
      (criticalErrors * 10) +  // Critical errors heavily weighted
      (highErrors * 5) +       // High errors moderately weighted
      (mediumErrors * 2)       // Medium errors lightly weighted
    );

    // Calculate base health score (higher error rate = lower health)
    const errorRate = errorScore / Math.max(totalLogs, 1);
    const baseHealth = Math.max(0, 100 - (errorRate * 20));

    // Apply additional factors
    let adjustedHealth = baseHealth;

    // Penalize for sustained high error rates
    const recentCritical = windowLogs.filter(log => 
      log.level === 'critical' && 
      !log.acknowledged &&
      isAfter(log.timestamp, subHours(now, 1))
    ).length;

    if (recentCritical > 0) {
      adjustedHealth -= (recentCritical * 15); // Heavy penalty for recent critical errors
    }

    // Bonus for acknowledged alerts (shows active management)
    const acknowledgedCount = windowLogs.filter(log => log.acknowledged).length;
    if (acknowledgedCount > 0 && totalLogs > 0) {
      const acknowledgmentBonus = Math.min(10, (acknowledgedCount / totalLogs) * 20);
      adjustedHealth += acknowledgmentBonus;
    }

    return Math.max(this.MIN_HEALTH_SCORE, Math.min(this.MAX_HEALTH_SCORE, Math.round(adjustedHealth)));
  }

  /**
   * Update site health history with new data point
   */
  static updateHealthHistory(site: Site, newScore: number, logs: LogEntry[]): HealthDataPoint[] {
    const now = new Date();
    const windowStart = subHours(now, this.HEALTH_WINDOW_HOURS);
    
    // Filter existing history to 24-hour window
    const validHistory = site.healthHistory.filter(point => 
      isAfter(point.timestamp, windowStart)
    );

    // Count errors and logs for this time period
    const recentLogs = logs.filter(log => 
      log.siteId === site.id && 
      isAfter(log.timestamp, subHours(now, 1)) // Last hour
    );

    const errorCount = recentLogs.filter(log => 
      ['critical', 'high', 'medium'].includes(log.level)
    ).length;

    // Add new data point
    const newDataPoint: HealthDataPoint = {
      timestamp: now,
      score: newScore,
      errorCount,
      logCount: recentLogs.length
    };

    return [...validHistory, newDataPoint];
  }

  /**
   * Determine site status based on health score and recent trends
   */
  static calculateSiteStatus(site: Site): 'green' | 'amber' | 'red' {
    const currentScore = site.healthScore;
    
    // Check if there are unacknowledged critical alerts
    const hasUnacknowledgedCritical = site.alertCounts.critical > 0;
    
    if (hasUnacknowledgedCritical || currentScore < 50) {
      return 'red';
    } else if (currentScore < 80) {
      return 'amber';
    } else {
      return 'green';
    }
  }

  /**
   * Check if site can be reset to green status after acknowledgment
   */
  static canResetToGreen(site: Site, logs: LogEntry[]): boolean {
    const now = new Date();
    const recentWindow = subHours(now, 1); // Check last hour
    
    // Get recent unacknowledged critical/high errors
    const recentCriticalErrors = logs.filter(log => 
      log.siteId === site.id &&
      isAfter(log.timestamp, recentWindow) &&
      ['critical', 'high'].includes(log.level) &&
      !log.acknowledged
    );

    // Can reset to green if no recent unacknowledged critical/high errors
    return recentCriticalErrors.length === 0;
  }

  /**
   * Get health trend over specified period
   */
  static getHealthTrend(site: Site, hours: number = 24): 'improving' | 'stable' | 'declining' {
    if (site.healthHistory.length < 2) {
      return 'stable';
    }

    const now = new Date();
    const windowStart = subHours(now, hours);
    const relevantHistory = site.healthHistory.filter(point => 
      isAfter(point.timestamp, windowStart)
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (relevantHistory.length < 2) {
      return 'stable';
    }

    const firstScore = relevantHistory[0].score;
    const lastScore = relevantHistory[relevantHistory.length - 1].score;
    const difference = lastScore - firstScore;

    if (difference > 10) {
      return 'improving';
    } else if (difference < -10) {
      return 'declining';
    } else {
      return 'stable';
    }
  }
}