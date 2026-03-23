import React, { useState, useEffect } from 'react';
import { Shield, Save } from 'lucide-react';

interface AuthConfigProps {
  onDataUpdate?: () => void;
}

export function AuthConfig({ onDataUpdate }: AuthConfigProps) {
  const [authRequired, setAuthRequired] = useState(false);
  const [requireAcknowledgment, setRequireAcknowledgment] = useState(true);
  const [acknowledgmentSeverities, setAcknowledgmentSeverities] = useState<string[]>(['critical', 'high']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      fetch('/api/auth/config', { credentials: 'include' })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setAuthRequired(data.authRequired ?? false);
            setRequireAcknowledgment(data.requireAcknowledgment ?? true);
            setAcknowledgmentSeverities(data.acknowledgmentSeverities ?? ['critical', 'high']);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          authRequired,
          requireAcknowledgment,
          acknowledgmentSeverities
        })
      });
      if (res.ok) {
        onDataUpdate?.();
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const toggleSeverity = (sev: string) => {
    setAcknowledgmentSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
    );
  };

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" />
            Access & Acknowledgment
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Require login and configure acknowledgment settings.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="p-4 bg-slate-900 border border-slate-600 rounded-lg">
          <h4 className="text-white font-medium mb-2">Platform access</h4>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={authRequired}
              onChange={(e) => setAuthRequired(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            Require username and password to access the platform
          </label>
          <p className="text-slate-500 text-sm mt-2">
            When enabled, users must log in with username, password, full name, and email.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-600 rounded-lg">
          <h4 className="text-white font-medium mb-2">Alert acknowledgment</h4>
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={requireAcknowledgment}
              onChange={(e) => setRequireAcknowledgment(e.target.checked)}
              className="rounded bg-slate-800 border-slate-600"
            />
            Require acknowledgment for critical/high alerts
          </label>
          <p className="text-slate-500 text-sm mb-3">Select which severity levels require acknowledgment:</p>
          <div className="flex flex-wrap gap-4">
            {['critical', 'high', 'medium', 'low'].map((sev) => (
              <label key={sev} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledgmentSeverities.includes(sev)}
                  onChange={() => toggleSeverity(sev)}
                  className="rounded bg-slate-800 border-slate-600"
                />
                <span className="capitalize">{sev}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
