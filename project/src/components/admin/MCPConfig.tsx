/**
 * MCP Integration — enable LLM agents (Cursor, Claude Desktop) to use LogSentinel tools.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Plug, Copy, CheckCircle, AlertTriangle, RefreshCw, Key } from 'lucide-react';
import toast from 'react-hot-toast';

interface MCPConfigProps {
  onDataUpdate?: () => void;
}

interface McpConfigSafe {
  enabled: boolean;
  hasApiKey: boolean;
  hasEnvApiKey: boolean;
  enabledEffective: boolean;
  publicUrl: string;
  mcpServerPath: string;
  tools: string[];
  apiKey?: string;
}

export function MCPConfig({ onDataUpdate }: MCPConfigProps) {
  const [enabled, setEnabled] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasEnvApiKey, setHasEnvApiKey] = useState(false);
  const [enabledEffective, setEnabledEffective] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [tools, setTools] = useState<string[]>([]);
  const [cursorSnippet, setCursorSnippet] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp-config', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEnabled(data.enabled ?? false);
      setHasApiKey(data.hasApiKey ?? false);
      setHasEnvApiKey(data.hasEnvApiKey ?? false);
      setEnabledEffective(data.enabledEffective ?? false);
      setPublicUrl(data.publicUrl || '');
      setTools(data.tools || []);
      const snipRes = await fetch('/api/mcp-config/cursor-snippet', { credentials: 'include' });
      const snip = await snipRes.json();
      setCursorSnippet(JSON.stringify(snip, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load MCP config');
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const save = async (opts?: { regenerateKey?: boolean }) => {
    setSaveStatus(null);
    setError(null);
    try {
      const res = await fetch('/api/mcp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled,
          publicUrl,
          apiKey: apiKey || undefined,
          regenerateKey: opts?.regenerateKey
        })
      });
      const data: McpConfigSafe = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Save failed');
      if (data.apiKey) {
        setRevealedKey(data.apiKey);
        setApiKey('');
      }
      setHasApiKey(data.hasApiKey ?? true);
      setEnabledEffective(data.enabledEffective ?? false);
      setSaveStatus('saved');
      onDataUpdate?.();
      await loadConfig();
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaveStatus('error');
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey: revealedKey || apiKey || undefined })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`MCP API OK — ${data.data?.logCount ?? 0} logs in buffer`);
      } else {
        toast.error(data.error || 'Test failed');
        setError(data.error || 'Test failed');
      }
    } catch (e) {
      toast.error('Test request failed');
    } finally {
      setTesting(false);
    }
  };

  const copySnippet = async () => {
    const snippet =
      revealedKey && cursorSnippet
        ? cursorSnippet.replace('<your-api-key-from-admin>', revealedKey)
        : cursorSnippet;
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success('Cursor MCP config copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const copyKey = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      toast.success('API key copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plug className="h-5 w-5 text-violet-400" />
            MCP Integration
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Connect Cursor or other MCP clients so an LLM can read logs, baselines, and run AI analysis.
          </p>
        </div>
        <button
          onClick={() => save()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Save className="h-4 w-4" />
          Save
          {saveStatus === 'saved' && <span className="text-green-300">✓</span>}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {hasEnvApiKey && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
          Server environment variable <code className="text-amber-200">LOGSENTINEL_MCP_API_KEY</code> is set and
          also enables the MCP API. UI settings apply in addition to the env key.
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-500 bg-slate-700 text-blue-500"
            />
            <span className="text-white font-medium">Enable MCP API</span>
          </label>
          <p className="text-slate-400 text-sm mt-2 ml-7">
            Exposes <code className="text-slate-300">/api/mcp/*</code> for external agents when an API key is configured.
          </p>
          <div className="mt-3 ml-7 flex items-center gap-2 text-sm">
            {enabledEffective ? (
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Active
              </span>
            ) : (
              <span className="text-slate-400">Inactive — enable and save an API key</span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 space-y-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Key className="h-4 w-4 text-violet-400" />
            API key
          </h4>
          {revealedKey && (
            <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
              <p className="text-violet-200 text-sm mb-2">Copy this key now — it will not be shown again in full.</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs text-slate-200 bg-slate-800 p-2 rounded break-all">{revealedKey}</code>
                <button
                  type="button"
                  onClick={copyKey}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {!revealedKey && hasApiKey && (
            <p className="text-slate-400 text-sm">An API key is saved. Generate a new one to view and copy it.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasApiKey ? 'Enter new key to replace' : 'Paste or generate a key'}
              className="flex-1 min-w-[200px] bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => save({ regenerateKey: true })}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
            >
              Generate key
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || (!hasApiKey && !revealedKey && !apiKey)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white rounded-lg text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
              Test
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
          <label className="block text-sm text-slate-300 mb-2">Public server URL (for Cursor MCP env)</label>
          <input
            type="url"
            value={publicUrl}
            onChange={(e) => setPublicUrl(e.target.value)}
            placeholder="http://localhost:3000"
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-slate-500 text-xs mt-2">Leave blank to use the URL you open in the browser.</p>
        </div>

        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">Cursor MCP configuration</h4>
            <button
              type="button"
              onClick={copySnippet}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
            >
              <Copy className="h-4 w-4" />
              Copy JSON
            </button>
          </div>
          <p className="text-slate-400 text-sm mb-3">
            Paste into Cursor Settings → MCP → Edit config. Replace the API key placeholder if you have not copied a key
            yet.
          </p>
          <pre className="text-xs text-slate-300 bg-slate-950 border border-slate-700 rounded-lg p-3 overflow-x-auto max-h-48">
            {revealedKey
              ? cursorSnippet.replace('<your-api-key-from-admin>', revealedKey)
              : cursorSnippet}
          </pre>
        </div>

        <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">Available MCP tools</h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-300">
            {(tools.length ? tools : [
              'logsentinel_status',
              'logsentinel_get_logs',
              'logsentinel_search_logs',
              'logsentinel_get_baselines',
              'logsentinel_service_improvement',
              'logsentinel_suggest_baselines'
            ]).map((t) => (
              <li key={t} className="font-mono text-violet-300/90 bg-slate-800/50 px-2 py-1 rounded">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
