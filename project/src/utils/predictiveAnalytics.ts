import { Site, LogEntry, MLAnomaly, HealthDataPoint } from '../types';
import { subHours, subDays, addHours, format, isAfter, isBefore } from 'date-fns';

export interface PredictionResult {
  type: 'failure' | 'capacity' | 'seasonal';
  confidence: number;
  timeToEvent: number; // hours
  description: string;
  recommendedActions: string[];
  affectedSites: string[];
}

export interface CapacityForecast {
  siteId: string;
  siteName: string;
  currentLogVolume: number;
  predictedVolume: number;
  capacityUtilization: number;
  timeToCapacity: number; // hours until 90% capacity
  recommendedActions: string[];
}

export interface SeasonalPattern {
  pattern: 'hourly' | 'daily' | 'weekly' | 'monthly';
  description: string;
  peakTimes: string[];
  expectedIncrease: number; // percentage
  nextOccurrence: Date;
  confidence: number;
}

/** Payload from server predictive analytics (WebSocket predictions message) */
export interface ServerPredictionsPayload {
  predictions: PredictionResult[];
  capacityForecasts: CapacityForecast[];
  seasonalPatterns: (Omit<SeasonalPattern, 'nextOccurrence'> & { nextOccurrence: string })[];
  timestamp: string;
}

export class PredictiveAnalytics {
  private static readonly FAILURE_THRESHOLD = 0.8;
  private static readonly CAPACITY_WARNING_THRESHOLD = 0.75;
  private static readonly SEASONAL_CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Predict system failures 2-4 hours in advance
   */
  static predictFailures(sites: Site[], logs: LogEntry[], anomalies: MLAnomaly[]): PredictionResult[] {
    const predictions: PredictionResult[] = [];
    const now = new Date();

    sites.forEach(site => {
      // Analyze recent trends for this site
      const recentLogs = logs.filter(log => 
        log.siteId === site.id && 
        isAfter(log.timestamp, subHours(now, 6))
      );

      const recentAnomalies = anomalies.filter(anomaly => 
        anomaly.siteId === site.id && 
        isAfter(anomaly.timestamp, subHours(now, 2))
      );

      // Calculate failure probability based on multiple factors
      const errorRate = this.calculateErrorRate(recentLogs);
      const anomalyScore = this.calculateAnomalyScore(recentAnomalies);
      const healthTrend = this.calculateHealthTrend(site);
      const resourceStress = this.calculateResourceStress(recentLogs);

      const failureProbability = (
        errorRate * 0.3 +
        anomalyScore * 0.25 +
        (1 - healthTrend) * 0.25 +
        resourceStress * 0.2
      );

      if (failureProbability > this.FAILURE_THRESHOLD) {
        const timeToFailure = this.estimateTimeToFailure(failureProbability, recentLogs);
        
        predictions.push({
          type: 'failure',
          confidence: Math.min(95, failureProbability * 100),
          timeToEvent: timeToFailure,
          description: `High probability of system failure detected for ${site.name}`,
          recommendedActions: [
            'Investigate recent error patterns',
            'Check system resources',
            'Review recent deployments',
            'Prepare rollback procedures',
            'Alert on-call team'
          ],
          affectedSites: [site.id]
        });
      }
    });

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Forecast resource needs based on log volume trends
   */
  static forecastCapacity(sites: Site[], logs: LogEntry[]): CapacityForecast[] {
    const forecasts: CapacityForecast[] = [];
    const now = new Date();

    sites.forEach(site => {
      const historicalData = this.getHistoricalLogVolume(site.id, logs, 7); // 7 days
      const currentVolume = this.getCurrentLogVolume(site.id, logs);
      
      // Use linear regression to predict future volume
      const trend = this.calculateVolumeTrend(historicalData);
      const predictedVolume = currentVolume + (trend * 24); // 24 hours ahead
      
      // Estimate capacity based on current infrastructure
      const estimatedCapacity = this.estimateLogCapacity(site);
      const utilizationRate = predictedVolume / estimatedCapacity;
      
      if (utilizationRate > this.CAPACITY_WARNING_THRESHOLD) {
        const timeToCapacity = this.calculateTimeToCapacity(
          currentVolume, 
          trend, 
          estimatedCapacity * 0.9 // 90% capacity threshold
        );

        forecasts.push({
          siteId: site.id,
          siteName: site.name,
          currentLogVolume: currentVolume,
          predictedVolume,
          capacityUtilization: utilizationRate,
          timeToCapacity,
          recommendedActions: [
            'Scale log processing infrastructure',
            'Implement log rotation policies',
            'Archive older logs',
            'Optimize log parsing efficiency',
            'Consider distributed processing'
          ]
        });
      }
    });

    return forecasts.sort((a, b) => b.capacityUtilization - a.capacityUtilization);
  }

  /**
   * Detect and predict seasonal patterns
   */
  static detectSeasonalPatterns(logs: LogEntry[]): SeasonalPattern[] {
    const patterns: SeasonalPattern[] = [];
    const now = new Date();

    // Analyze hourly patterns (business hours vs off-hours)
    const hourlyPattern = this.analyzeHourlyPattern(logs);
    if (hourlyPattern.confidence > this.SEASONAL_CONFIDENCE_THRESHOLD) {
      patterns.push(hourlyPattern);
    }

    // Analyze daily patterns (weekdays vs weekends)
    const dailyPattern = this.analyzeDailyPattern(logs);
    if (dailyPattern.confidence > this.SEASONAL_CONFIDENCE_THRESHOLD) {
      patterns.push(dailyPattern);
    }

    // Analyze weekly patterns
    const weeklyPattern = this.analyzeWeeklyPattern(logs);
    if (weeklyPattern.confidence > this.SEASONAL_CONFIDENCE_THRESHOLD) {
      patterns.push(weeklyPattern);
    }

    // Analyze monthly patterns (month-end processing, etc.)
    const monthlyPattern = this.analyzeMonthlyPattern(logs);
    if (monthlyPattern.confidence > this.SEASONAL_CONFIDENCE_THRESHOLD) {
      patterns.push(monthlyPattern);
    }

    return patterns;
  }

  private static calculateErrorRate(logs: LogEntry[]): number {
    if (logs.length === 0) return 0;
    const errorLogs = logs.filter(log => ['critical', 'high'].includes(log.level));
    return errorLogs.length / logs.length;
  }

  private static calculateAnomalyScore(anomalies: MLAnomaly[]): number {
    if (anomalies.length === 0) return 0;
    const avgScore = anomalies.reduce((sum, a) => sum + a.score, 0) / anomalies.length;
    return avgScore / 100; // Normalize to 0-1
  }

  private static calculateHealthTrend(site: Site): number {
    if (site.healthHistory.length < 2) return site.healthScore / 100;
    
    const recent = site.healthHistory.slice(-5); // Last 5 data points
    const trend = recent[recent.length - 1].score - recent[0].score;
    return Math.max(0, Math.min(1, (site.healthScore + trend) / 100));
  }

  private static calculateResourceStress(logs: LogEntry[]): number {
    // Analyze log patterns that indicate resource stress
    const memoryWarnings = logs.filter(log => 
      log.message.toLowerCase().includes('memory') || 
      log.errorCode === 'SYS_001'
    ).length;
    
    const diskWarnings = logs.filter(log => 
      log.message.toLowerCase().includes('disk') || 
      log.errorCode === 'DISK_001'
    ).length;
    
    const networkIssues = logs.filter(log => 
      log.message.toLowerCase().includes('network') || 
      log.errorCode === 'NET_001'
    ).length;
    
    const totalStressIndicators = memoryWarnings + diskWarnings + networkIssues;
    return Math.min(1, totalStressIndicators / Math.max(logs.length, 1) * 10);
  }

  private static estimateTimeToFailure(probability: number, recentLogs: LogEntry[]): number {
    // Estimate based on error acceleration
    const errorAcceleration = this.calculateErrorAcceleration(recentLogs);
    const baseTime = 4; // 4 hours base prediction window
    
    // Higher probability and acceleration = shorter time to failure
    return Math.max(0.5, baseTime * (1 - probability) / Math.max(errorAcceleration, 0.1));
  }

  private static calculateErrorAcceleration(logs: LogEntry[]): number {
    const now = new Date();
    const hour1 = logs.filter(log => 
      isAfter(log.timestamp, subHours(now, 1)) && ['critical', 'high'].includes(log.level)
    ).length;
    
    const hour2 = logs.filter(log => 
      isAfter(log.timestamp, subHours(now, 2)) && 
      isBefore(log.timestamp, subHours(now, 1)) && 
      ['critical', 'high'].includes(log.level)
    ).length;
    
    return hour1 > hour2 ? (hour1 - hour2) / Math.max(hour2, 1) : 0;
  }

  private static getHistoricalLogVolume(siteId: string, logs: LogEntry[], days: number): number[] {
    const volumes: number[] = [];
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const dayStart = subDays(now, i);
      const dayEnd = addHours(dayStart, 24);
      
      const dayLogs = logs.filter(log => 
        log.siteId === siteId &&
        isAfter(log.timestamp, dayStart) &&
        isBefore(log.timestamp, dayEnd)
      );
      
      volumes.push(dayLogs.length);
    }
    
    return volumes;
  }

  private static getCurrentLogVolume(siteId: string, logs: LogEntry[]): number {
    const now = new Date();
    const last24Hours = logs.filter(log => 
      log.siteId === siteId && 
      isAfter(log.timestamp, subHours(now, 24))
    );
    
    return last24Hours.length;
  }

  private static calculateVolumeTrend(volumes: number[]): number {
    if (volumes.length < 2) return 0;
    
    // Simple linear regression
    const n = volumes.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = volumes.reduce((sum, v) => sum + v, 0);
    const sumXY = volumes.reduce((sum, v, i) => sum + (i * v), 0);
    const sumX2 = volumes.reduce((sum, _, i) => sum + (i * i), 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private static estimateLogCapacity(site: Site): number {
    // Estimate based on site configuration and historical patterns
    const baseCapacity = 10000; // Base logs per day
    const configMultiplier = site.monitoringConfig?.filePatterns?.length || 1;
    const recursiveMultiplier = site.monitoringConfig?.recursive ? 2 : 1;
    
    return baseCapacity * configMultiplier * recursiveMultiplier;
  }

  private static calculateTimeToCapacity(current: number, trend: number, capacity: number): number {
    if (trend <= 0) return Infinity;
    return Math.max(0, (capacity - current) / trend);
  }

  private static analyzeHourlyPattern(logs: LogEntry[]): SeasonalPattern {
    const hourlyVolumes = new Array(24).fill(0);
    
    logs.forEach(log => {
      const hour = log.timestamp.getHours();
      hourlyVolumes[hour]++;
    });
    
    const avgVolume = hourlyVolumes.reduce((sum, v) => sum + v, 0) / 24;
    const peakHours = hourlyVolumes
      .map((volume, hour) => ({ hour, volume }))
      .filter(({ volume }) => volume > avgVolume * 1.5)
      .map(({ hour }) => `${hour}:00`);
    
    const variance = hourlyVolumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / 24;
    const confidence = Math.min(0.95, variance / (avgVolume * avgVolume));
    
    return {
      pattern: 'hourly',
      description: 'Business hours show increased activity',
      peakTimes: peakHours,
      expectedIncrease: Math.max(...hourlyVolumes) / avgVolume * 100 - 100,
      nextOccurrence: this.getNextBusinessHour(),
      confidence
    };
  }

  private static analyzeDailyPattern(logs: LogEntry[]): SeasonalPattern {
    const dailyVolumes = new Array(7).fill(0); // 0 = Sunday
    
    logs.forEach(log => {
      const day = log.timestamp.getDay();
      dailyVolumes[day]++;
    });
    
    const weekdayAvg = (dailyVolumes[1] + dailyVolumes[2] + dailyVolumes[3] + dailyVolumes[4] + dailyVolumes[5]) / 5;
    const weekendAvg = (dailyVolumes[0] + dailyVolumes[6]) / 2;
    
    const confidence = Math.abs(weekdayAvg - weekendAvg) / Math.max(weekdayAvg, weekendAvg);
    
    return {
      pattern: 'daily',
      description: 'Weekdays show different patterns than weekends',
      peakTimes: weekdayAvg > weekendAvg ? ['Monday-Friday'] : ['Saturday-Sunday'],
      expectedIncrease: Math.abs(weekdayAvg - weekendAvg) / Math.min(weekdayAvg, weekendAvg) * 100,
      nextOccurrence: this.getNextWeekday(),
      confidence: Math.min(0.95, confidence)
    };
  }

  private static analyzeWeeklyPattern(logs: LogEntry[]): SeasonalPattern {
    // Analyze week-over-week patterns
    const weeklyData = this.groupLogsByWeek(logs);
    const avgWeeklyVolume = weeklyData.reduce((sum, week) => sum + week.volume, 0) / weeklyData.length;
    
    const variance = weeklyData.reduce((sum, week) => sum + Math.pow(week.volume - avgWeeklyVolume, 2), 0) / weeklyData.length;
    const confidence = Math.min(0.95, variance / (avgWeeklyVolume * avgWeeklyVolume));
    
    return {
      pattern: 'weekly',
      description: 'Weekly patterns detected in log volume',
      peakTimes: ['Week start', 'Week end'],
      expectedIncrease: 15, // Typical weekly variation
      nextOccurrence: this.getNextMonday(),
      confidence
    };
  }

  private static analyzeMonthlyPattern(logs: LogEntry[]): SeasonalPattern {
    // Analyze month-end patterns
    const monthEndLogs = logs.filter(log => {
      const date = log.timestamp.getDate();
      const lastDay = new Date(log.timestamp.getFullYear(), log.timestamp.getMonth() + 1, 0).getDate();
      return date >= lastDay - 2; // Last 3 days of month
    });
    
    const monthEndVolume = monthEndLogs.length;
    const totalVolume = logs.length;
    const monthEndRatio = monthEndVolume / totalVolume;
    
    const confidence = monthEndRatio > 0.15 ? 0.8 : 0.3; // If >15% of logs are month-end
    
    return {
      pattern: 'monthly',
      description: 'Month-end processing increases log volume',
      peakTimes: ['Month-end'],
      expectedIncrease: monthEndRatio * 100,
      nextOccurrence: this.getNextMonthEnd(),
      confidence
    };
  }

  private static groupLogsByWeek(logs: LogEntry[]): Array<{ week: number; volume: number }> {
    const weeks = new Map<number, number>();
    
    logs.forEach(log => {
      const weekNumber = this.getWeekNumber(log.timestamp);
      weeks.set(weekNumber, (weeks.get(weekNumber) || 0) + 1);
    });
    
    return Array.from(weeks.entries()).map(([week, volume]) => ({ week, volume }));
  }

  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private static getNextBusinessHour(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM next day
    return tomorrow;
  }

  private static getNextWeekday(): Date {
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    return nextMonday;
  }

  private static getNextMonday(): Date {
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    return nextMonday;
  }

  private static getNextMonthEnd(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return nextMonth;
  }
}