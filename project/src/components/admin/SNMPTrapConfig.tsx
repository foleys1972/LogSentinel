/**
 * SNMP trap forwarding configuration.
 * Forward alerts and critical logs to an SNMP trap receiver based on criticality.
 */

import React, { useState, useEffect } from 'react';
import { Save, Radio, AlertTriangle, Send } from 'lucide-react';
import { SNMP_CONFIG_STORAGE_KEY, forwardTrapManually } from '../../utils/snmpTrapForwarder';
import type { SnmpTrapConfig } from '../../utils/snmpTrapForwarder';
import toast from 'react-hot-toast';

interface SNMPTrapConfigProps {
  onDataUpdate?: () => void;
}

export function SNMPTrapConfig({ onDataUpdate }: SNMPTrapConfigProps) {
  const [config, setConfig] = useState<SnmpTrapConfig>({
    enabled: false,
    host: '',
    port: 162,
    community: 'public',
    severityFilter: ['critical', 'high'],
    forwardAlerts: true,
    forwardLogs: true
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | null>(null);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SNMP_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = () => {
    try {
      localStorage.setItem(SNMP_CONFIG_STORAGE_KEY, JSON.stringify(config));
      setSaveStatus('saved');
      onDataUpdate?.();
      window.dispatchEvent(new CustomEvent('snmp-config-updated'));
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (e) {
      console.error('Failed to save SNMP config:', e);
    }
  };

  const toggleSeverity = (sev: 'critical' | 'high' | 'medium' | 'low') => {
    setConfig((prev) => {
      const next = prev.severityFilter.includes(sev)
        ? prev.severityFilter.filter((s) => s !== sev)
        : [...prev.severityFilter, sev];
      return { ...prev, severityFilter: next };
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Radio className="h-5 w-5 text-cyan-400" />
            SNMP Trap Forwarding
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Forward alerts and critical logs to an SNMP trap receiver based on severity. Requires net-snmp.
          </p>
        </div>
        <button
          onClick={save}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
        >
          <Save className="h-4 w-4" />
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={config.enabled}
            onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="rounded bg-slate-800 border-slate-600"
          />
          <label htmlFor="enabled" className="text-white font-medium">
            Enable SNMP trap forwarding
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Trap receiver host</label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig((prev) => ({ ...prev, host: e.target.value }))}
              placeholder="192.168.1.100 or snmp.example.com"
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Port</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig((prev) => ({ ...prev, port: parseInt(e.target.value) || 162 }))}
              min={1}
              max={65535}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Default: 162</p>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Community string</label>
          <input
            type="text"
            value={config.community}
            onChange={(e) => setConfig((prev) => ({ ...prev, community: e.target.value }))}
            placeholder="public"
            className="w-full max-w-xs bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="p-4 bg-slate-900 border border-slate-600 rounded-lg">
          <h4 className="text-white font-medium mb-2">Forward by severity</h4>
          <p className="text-slate-400 text-sm mb-3">Select which severity levels trigger a trap.</p>
          <div className="flex flex-wrap gap-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
              <label key={sev} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.severityFilter.includes(sev)}
                  onChange={() => toggleSeverity(sev)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <span className="capitalize">{sev}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-600 rounded-lg">
          <h4 className="text-white font-medium mb-2">Forward sources</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.forwardAlerts}
                onChange={(e) => setConfig((prev) => ({ ...prev, forwardAlerts: e.target.checked }))}
                className="rounded bg-slate-800 border-slate-600"
              />
              Smart alerts (from alert rules)
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.forwardLogs}
                onChange={(e) => setConfig((prev) => ({ ...prev, forwardLogs: e.target.checked }))}
                className="rounded bg-slate-800 border-slate-600"
              />
              Critical/high logs (from log stream)
            </label>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-600 rounded-lg">
          <h4 className="text-white font-medium mb-2">Manual forward</h4>
          <p className="text-slate-400 text-sm mb-3">
            Send a test trap to verify configuration. You can also forward any alert manually from Smart Alerting → Active Alerts (Forward SNMP button).
          </p>
          <button
            onClick={async () => {
              if (!config.enabled || !config.host?.trim()) {
                toast.error('Enable SNMP and set host first');
                return;
              }
              setTestSending(true);
              const r = await forwardTrapManually('high', {
                title: 'LogSentinel test trap',
                description: 'Manual test from SNMP settings',
                siteName: 'Test'
              });
              setTestSending(false);
              if (r.success) toast.success('Test trap sent');
              else toast.error(r.error || 'Failed to send');
            }}
            disabled={testSending || !config.enabled || !config.host?.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm"
          >
            <Send className="h-4 w-4" />
            {testSending ? 'Sending…' : 'Send test trap'}
          </button>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-medium">Requires net-snmp</p>
            <p className="text-amber-200/80 mt-1">
              Run <code className="bg-slate-800 px-1 rounded">npm install net-snmp</code> for trap forwarding. In web mode, the server must be running. In Electron mode, traps are sent from the main process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
