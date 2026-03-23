/**
 * LLM configuration - OpenAI, Mistral, Ollama, Azure (Copilot).
 * AI reviews logs, alarm codes, anomalies, and suggests fixes in Service Improvement.
 */

import React, { useState, useEffect } from 'react';
import { Save, Sparkles, AlertTriangle } from 'lucide-react';

interface LLMConfigProps {
  onDataUpdate?: () => void;
}

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI (ChatGPT)', keyLabel: 'OpenAI API Key', keyPlaceholder: 'sk-...' },
  { id: 'mistral', label: 'Mistral AI', keyLabel: 'Mistral API Key', keyPlaceholder: '...' },
  { id: 'ollama', label: 'Ollama (local)', keyLabel: null, keyPlaceholder: null },
  { id: 'azure', label: 'Azure OpenAI (Copilot)', keyLabel: 'Azure API Key', keyPlaceholder: '...' }
];

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama'],
  azure: []
};

export function LLMConfig({ onDataUpdate }: LLMConfigProps) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [deployment, setDeployment] = useState('');
  const [continuousEvaluationEnabled, setContinuousEvaluationEnabled] = useState(false);
  const [continuousEvaluationPrompt, setContinuousEvaluationPrompt] = useState('');
  const [continuousEvaluationIntervalMinutes, setContinuousEvaluationIntervalMinutes] = useState(5);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/llm-config', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setEnabled(data.enabled ?? false);
        setProvider(data.provider || 'openai');
        setModel(data.model || 'gpt-4o-mini');
        setHasApiKey(data.hasApiKey ?? false);
        setBaseUrl(data.baseUrl || '');
        setDeployment(data.deployment || '');
        setContinuousEvaluationEnabled(data.continuousEvaluationEnabled ?? false);
        setContinuousEvaluationPrompt(data.continuousEvaluationPrompt || '');
        setContinuousEvaluationIntervalMinutes(data.continuousEvaluationIntervalMinutes ?? 5);
      })
      .catch(() => setError('Could not load LLM config'));
  }, []);

  const handleSave = async () => {
    setSaveStatus(null);
    setError(null);
    try {
      const res = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled,
          provider,
          model,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          deployment: deployment || undefined,
          continuousEvaluationEnabled,
          continuousEvaluationPrompt,
          continuousEvaluationIntervalMinutes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setHasApiKey(data.hasApiKey ?? !!apiKey);
      setApiKey('');
      setSaveStatus('saved');
      onDataUpdate?.();
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaveStatus('error');
    }
  };

  const needsApiKey = provider !== 'ollama';
  const models = MODEL_OPTIONS[provider] || MODEL_OPTIONS.openai;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            AI / LLM Configuration
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Mistral, Ollama, ChatGPT, or Copilot. AI reviews logs, alarm codes, anomalies, and suggests fixes in Service Improvement.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
        >
          <Save className="h-4 w-4" />
          {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="llm-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded bg-slate-800 border-slate-600"
          />
          <label htmlFor="llm-enabled" className="text-white font-medium">
            Enable AI (anomaly summaries, remediation, Service Improvement suggestions)
          </label>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {needsApiKey && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              {PROVIDER_OPTIONS.find((p) => p.id === provider)?.keyLabel || 'API Key'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? '•••••••• (leave blank to keep current)' : (PROVIDER_OPTIONS.find((p) => p.id === provider)?.keyPlaceholder || '')}
              className="w-full max-w-md bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
            {provider === 'openai' && (
              <p className="text-xs text-slate-500 mt-1">Get key from platform.openai.com</p>
            )}
            {provider === 'mistral' && (
              <p className="text-xs text-slate-500 mt-1">Get key from console.mistral.ai</p>
            )}
          </div>
        )}

        {provider === 'ollama' && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Ollama base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full max-w-md bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {provider === 'azure' && (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Azure endpoint (e.g. https://your-resource.openai.azure.com)</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-resource.openai.azure.com"
                className="w-full max-w-md bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Deployment name</label>
              <input
                type="text"
                value={deployment}
                onChange={(e) => setDeployment(e.target.value)}
                placeholder="gpt-4"
                className="w-full max-w-md bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">
            {provider === 'azure' ? 'Model / Deployment name' : 'Model'}
          </label>
          {provider === 'azure' ? (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4"
              className="w-full max-w-md bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        <div className="border-t border-slate-700 pt-6 space-y-4">
          <h4 className="text-sm font-semibold text-white">Continuous log evaluation</h4>
          <p className="text-sm text-slate-400">
            Run a custom prompt periodically on recent logs. The LLM evaluates logs and returns an assessment.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="continuous-eval-enabled"
              checked={continuousEvaluationEnabled}
              onChange={(e) => setContinuousEvaluationEnabled(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            <label htmlFor="continuous-eval-enabled" className="text-white font-medium">
              Enable continuous evaluation
            </label>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Evaluation prompt</label>
            <textarea
              value={continuousEvaluationPrompt}
              onChange={(e) => setContinuousEvaluationPrompt(e.target.value)}
              placeholder="e.g. You are a security analyst. Evaluate these logs for suspicious activity, failed logins, or policy violations."
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Interval (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={continuousEvaluationIntervalMinutes}
              onChange={(e) => setContinuousEvaluationIntervalMinutes(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 5)))}
              className="w-24 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-medium">Server-side only</p>
            <p className="text-amber-200/80 mt-1">
              AI runs on the server. Ensure the server is running. For Ollama, run <code className="bg-slate-800 px-1 rounded">ollama serve</code> locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
