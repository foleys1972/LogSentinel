/**
 * Service Improvement - Trends, areas for concern, and critical alerts to fix
 * AI (Mistral, Ollama, ChatGPT, Copilot) suggests fixes when enabled.
 */

import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Target,
  ChevronRight,
  X,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Database
} from 'lucide-react';
import { Site, LogEntry, MLAnomaly } from '../types';
import { format, subDays } from 'date-fns';

interface LLMEvaluationResult {
  timestamp: string;
  evaluation: string;
  logCount: number;
}

interface ServiceImprovementPanelProps {
  sites: Site[];
  logs: LogEntry[];
  anomalies: MLAnomaly[];
  llmEvaluationResult?: LLMEvaluationResult | null;
  isOpen: boolean;
  onClose: () => void;
}

const THEME_PATTERNS = [
  { regex: /timeout|timed out|timing out/i, theme: 'Timeout', fix: 'Review connection timeouts; increase limits or optimize slow operations' },
  { regex: /connection|connect|disconnect/i, theme: 'Connection', fix: 'Check network stability, firewall rules, and service availability' },
  { regex: /auth|login|password|credential|unauthorized/i, theme: 'Authentication', fix: 'Audit credentials, token expiry, and access policies' },
  { regex: /disk|space|storage|full|quota/i, theme: 'Disk/Storage', fix: 'Implement log rotation, increase disk space, or add cleanup jobs' },
  { regex: /memory|oom|out of memory/i, theme: 'Memory', fix: 'Tune JVM/heap limits or optimize memory-intensive processes' },
  { regex: /error|exception|failed|failure/i, theme: 'Error/Failure', fix: 'Review error handling and add retries or fallbacks' },
  { regex: /network|socket|refused|unreachable/i, theme: 'Network', fix: 'Verify connectivity, DNS, and firewall rules' },
  { regex: /database|sql|query/i, theme: 'Database', fix: 'Optimize queries, check connection pool, review indexes' },
  { regex: /permission|access denied|forbidden/i, theme: 'Permission', fix: 'Review file permissions and service account access' }
];

function extractThemes(message: string): { theme: string; fix: string }[] {
  const result: { theme: string; fix: string }[] = [];
  for (const { regex, theme, fix } of THEME_PATTERNS) {
    if (regex.test(message)) result.push({ theme, fix });
  }
  return result;
}

export function ServiceImprovementPanel({ sites, logs, anomalies, llmEvaluationResult, isOpen, onClose }: ServiceImprovementPanelProps) {
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [baselineSuggestions, setBaselineSuggestions] = useState<{ addKnownErrorPatterns: { source: string; errorCode: string }[]; addKnownMessagePatterns: { source: string; signature: string }[] } | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [baselineApplied, setBaselineApplied] = useState<number | null>(null);

  const analysis = useMemo(() => {
    const now = new Date();
    const last7d = logs.filter(l => new Date(l.timestamp) >= subDays(now, 7));
    const last24h = logs.filter(l => new Date(l.timestamp) >= subDays(now, 1));

    const criticalLogs = logs.filter(l => l.level === 'critical' || l.level === 'high');
    const themeCount = new Map<string, { count: number; fix: string }>();
    const errorCodeCount = new Map<string, number>();
    const sourceCount = new Map<string, number>();
    const siteAlarmCount = new Map<string, number>();

    logs.forEach(log => {
      extractThemes(log.message).forEach(({ theme, fix }) => {
        const cur = themeCount.get(theme) || { count: 0, fix };
        themeCount.set(theme, { count: cur.count + 1, fix });
      });
      if (log.errorCode) errorCodeCount.set(log.errorCode, (errorCodeCount.get(log.errorCode) || 0) + 1);
      const src = log.source || log.fileInfo?.fileName || 'Unknown';
      sourceCount.set(src, (sourceCount.get(src) || 0) + 1);
      siteAlarmCount.set(log.siteId, (siteAlarmCount.get(log.siteId) || 0) + 1);
    });

    const trends: { label: string; direction: 'up' | 'down'; severity: 'good' | 'bad'; detail: string }[] = [];
    const rate7d = last7d.length / 7;
    const rate24h = last24h.length;
    if (rate24h > rate7d * 1.5) {
      trends.push({ label: 'Alert volume increasing', direction: 'up', severity: 'bad', detail: `24h: ${rate24h} vs 7d avg: ${rate7d.toFixed(0)}/day` });
    } else if (rate24h < rate7d * 0.5 && last7d.length > 10) {
      trends.push({ label: 'Alert volume decreasing', direction: 'down', severity: 'good', detail: `24h: ${rate24h} vs 7d avg: ${rate7d.toFixed(0)}/day` });
    }

    const criticalSites = sites.filter(s => s.status === 'red');
    if (criticalSites.length > 0) {
      trends.push({ label: 'Sites in critical status', direction: 'up', severity: 'bad', detail: `${criticalSites.map(s => s.name).join(', ')}` });
    }

    const concerns: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    const topThemes = Array.from(themeCount.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    topThemes.forEach(([theme, { count, fix }]) => {
      const pct = logs.length ? (count / logs.length) * 100 : 0;
      if (pct > 10) concerns.push({ title: `High volume: ${theme}`, description: `${count} occurrences (${pct.toFixed(1)}%). ${fix}`, priority: pct > 25 ? 'high' : 'medium' });
    });

    const worstSites = Array.from(siteAlarmCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    worstSites.forEach(([siteId, count]) => {
      const site = sites.find(s => s.id === siteId);
      if (site && count > 5) concerns.push({ title: `Site: ${site.name}`, description: `${count} alarms in period. Review monitoring config and log sources.`, priority: count > 20 ? 'high' : 'medium' });
    });

    const topErrorCodes = Array.from(errorCodeCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const fixRecommendations: { title: string; impact: string; action: string; count: number }[] = [];
    topErrorCodes.forEach(([code, count]) => {
      if (count >= 2) fixRecommendations.push({ title: `Error code: ${code}`, impact: `Fixing this would eliminate ${count} alerts`, action: 'Add to Error Code Manager with resolution steps', count });
    });

    topThemes.forEach(([theme, { count, fix }]) => {
      const criticalForTheme = logs.filter(l => extractThemes(l.message).some(t => t.theme === theme) && (l.level === 'critical' || l.level === 'high')).length;
      if (criticalForTheme >= 2) fixRecommendations.push({ title: `Theme: ${theme}`, impact: `${criticalForTheme} critical/high alerts`, action: fix, count: criticalForTheme });
    });

    const topSources = Array.from(sourceCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    topSources.forEach(([source, count]) => {
      if (count > 10) fixRecommendations.push({ title: `Source: ${source}`, impact: `${count} alerts from this file`, action: 'Review log format, add parsing rules, or exclude noisy entries', count });
    });

    return { trends, concerns, fixRecommendations, summary: { totalLogs: logs.length, criticalLogs: criticalLogs.length, anomalies: anomalies.length } };
  }, [sites, logs, anomalies]);

  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/llm-service-improvement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(analysis)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAiSuggestions(data.actions || []);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Failed to get suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchBaselineSuggestions = async (apply = false) => {
    setBaselineLoading(true);
    setBaselineError(null);
    setBaselineApplied(null);
    try {
      const res = await fetch('/api/llm-update-baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          context: { anomalies: anomalies.slice(0, 10), recentLogs: logs.slice(-50) },
          apply
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      setBaselineSuggestions(data.suggestions || null);
      if (apply && data.applied) setBaselineApplied(data.applied.applied ?? 0);
    } catch (e) {
      setBaselineError(e instanceof Error ? e.message : 'Failed to get suggestions');
    } finally {
      setBaselineLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Lightbulb className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Service Improvement</h2>
              <p className="text-slate-400">Trends, concerns, and critical fixes to reduce issues</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-100px)] p-6 space-y-6">
          {/* AI Suggestions */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Sparkles className="h-5 w-5 text-amber-400" />
                AI Suggestions
              </h3>
              <button
                onClick={fetchAiSuggestions}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 text-white rounded-lg text-sm"
              >
                <Sparkles className="h-4 w-4" />
                {aiLoading ? 'Analyzing…' : 'Get AI suggestions'}
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-3">
              Configure Mistral, Ollama, ChatGPT, or Copilot in Admin → AI/LLM. AI reviews logs and alarm codes to suggest fixes.
            </p>
            {aiError && <p className="text-sm text-red-400 mb-2">{aiError}</p>}
            {aiSuggestions && aiSuggestions.length > 0 && (
              <ul className="space-y-2">
                {aiSuggestions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <ChevronRight className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Continuous LLM evaluation */}
          {llmEvaluationResult && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Continuous log evaluation
              </h3>
              <p className="text-xs text-slate-500 mb-2">
                Last run: {format(new Date(llmEvaluationResult.timestamp), 'PPp')} · {llmEvaluationResult.logCount} logs
              </p>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">{llmEvaluationResult.evaluation}</div>
            </div>
          )}

          {/* Update ML baselines via LLM */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
              <Database className="h-5 w-5 text-blue-400" />
              Update ML baselines
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              AI suggests patterns to add to known baselines so the ML model stops flagging them as anomalies.
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => fetchBaselineSuggestions(false)}
                disabled={baselineLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg text-sm"
              >
                <Database className="h-4 w-4" />
                {baselineLoading ? 'Suggesting…' : 'Suggest updates'}
              </button>
              <button
                onClick={() => fetchBaselineSuggestions(true)}
                disabled={baselineLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg text-sm"
              >
                Suggest & apply
              </button>
            </div>
            {baselineError && <p className="text-sm text-red-400 mb-2">{baselineError}</p>}
            {baselineApplied !== null && (
              <p className="text-sm text-green-400 mb-2">Applied {baselineApplied} pattern(s) to baselines.</p>
            )}
            {baselineSuggestions && (
              <div className="text-sm text-slate-300 space-y-2">
                {baselineSuggestions.addKnownErrorPatterns?.length > 0 && (
                  <div>
                    <span className="text-slate-400">Error patterns:</span>{' '}
                    {baselineSuggestions.addKnownErrorPatterns.map((p, i) => (
                      <span key={i} className="bg-slate-700 px-1.5 py-0.5 rounded mr-1">
                        {p.source}_{p.errorCode}
                      </span>
                    ))}
                  </div>
                )}
                {baselineSuggestions.addKnownMessagePatterns?.length > 0 && (
                  <div>
                    <span className="text-slate-400">Message patterns:</span>{' '}
                    {baselineSuggestions.addKnownMessagePatterns.map((p, i) => (
                      <span key={i} className="bg-slate-700 px-1.5 py-0.5 rounded mr-1">
                        {p.source}_{p.signature}
                      </span>
                    ))}
                  </div>
                )}
                {(!baselineSuggestions.addKnownErrorPatterns?.length && !baselineSuggestions.addKnownMessagePatterns?.length) && (
                  <p className="text-slate-500">No suggestions. AI found no new patterns to add.</p>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-white">{analysis.summary.totalLogs}</div>
              <div className="text-sm text-slate-400">Total logs analyzed</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-red-400">{analysis.summary.criticalLogs}</div>
              <div className="text-sm text-slate-400">Critical/High alerts</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="text-2xl font-bold text-purple-400">{analysis.summary.anomalies}</div>
              <div className="text-sm text-slate-400">ML anomalies</div>
            </div>
          </div>

          {/* Trends */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              Trends
            </h3>
            {analysis.trends.length === 0 ? (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 text-slate-400">No significant trends detected. Need more data.</div>
            ) : (
              <div className="space-y-2">
                {analysis.trends.map((t, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${t.severity === 'bad' ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    {t.severity === 'bad' ? <AlertTriangle className="h-5 w-5 text-red-400" /> : <CheckCircle2 className="h-5 w-5 text-green-400" />}
                    <div>
                      <div className="font-medium text-white">{t.label}</div>
                      <div className="text-sm text-slate-400">{t.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Areas for Concern */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Areas for Concern
            </h3>
            {analysis.concerns.length === 0 ? (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 text-slate-400">No major concerns identified.</div>
            ) : (
              <div className="space-y-2">
                {analysis.concerns.map((c, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${c.priority === 'high' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-700'}`}>
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-white">{c.title}</div>
                        <div className="text-sm text-slate-400 mt-1">{c.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical Fixes */}
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
              <Target className="h-5 w-5 text-green-400" />
              Fix These to Reduce Issues
            </h3>
            <p className="text-sm text-slate-400 mb-3">Addressing these would have the highest impact on reducing alerts.</p>
            {analysis.fixRecommendations.length === 0 ? (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 text-slate-400">No high-impact fixes identified. Data may be limited.</div>
            ) : (
              <div className="space-y-2">
                {analysis.fixRecommendations
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 8)
                  .map((r, i) => (
                    <div key={i} className="p-3 rounded-lg border border-slate-700 bg-slate-900 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-white">{r.title}</div>
                          <div className="text-sm text-green-400 mt-1">{r.impact}</div>
                          <div className="text-sm text-slate-400 mt-1">{r.action}</div>
                        </div>
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">{r.count} alerts</span>
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
