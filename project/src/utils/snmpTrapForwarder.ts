/**
 * SNMP trap forwarder - sends alerts/issues to configured trap receiver.
 * Uses API (web mode) or Electron IPC (desktop mode) based on environment.
 */

export interface SnmpTrapConfig {
  enabled: boolean;
  host: string;
  port: number;
  community: string;
  severityFilter: ('critical' | 'high' | 'medium' | 'low')[];
  forwardAlerts: boolean;
  forwardLogs: boolean;
}

export const SNMP_CONFIG_STORAGE_KEY = 'snmpTrapConfig';
const DEFAULT_CONFIG: SnmpTrapConfig = {
  enabled: false,
  host: '',
  port: 162,
  community: 'public',
  severityFilter: ['critical', 'high'],
  forwardAlerts: true,
  forwardLogs: true
};

export function getSnmpConfig(): SnmpTrapConfig {
  try {
    const saved = localStorage.getItem(SNMP_CONFIG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export function shouldForwardBySeverity(config: SnmpTrapConfig, severity: string): boolean {
  if (!config.enabled || !config.host?.trim()) return false;
  return config.severityFilter.includes(severity as SnmpTrapConfig['severityFilter'][number]);
}

async function sendViaApi(config: SnmpTrapConfig, payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const res = await fetch(`${base}/api/snmp-trap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      config: { host: config.host, port: config.port, community: config.community },
      payload
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: data.error || res.statusText };
  return { success: true };
}

async function sendViaElectron(config: SnmpTrapConfig, payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'No window' };
  try {
    const electron = (window as unknown as { require: (m: string) => { ipcRenderer: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } } }).require('electron');
    const result = await electron.ipcRenderer.invoke('send-snmp-trap', { host: config.host, port: config.port, community: config.community }, payload) as { success?: boolean; error?: string };
    return { success: result?.success ?? false, error: result?.error };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return typeof (window as unknown as { require?: (m: string) => unknown }).require === 'function';
  } catch {
    return false;
  }
}

export async function forwardTrap(
  type: 'alert' | 'log',
  severity: string,
  payload: {
    title?: string;
    description?: string;
    message?: string;
    source?: string;
    siteName?: string;
    affectedSites?: string[];
    errorCode?: string;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  const config = getSnmpConfig();
  if (!shouldForwardBySeverity(config, severity)) return { success: true };

  if (type === 'alert' && !config.forwardAlerts) return { success: true };
  if (type === 'log' && !config.forwardLogs) return { success: true };

  return sendTrap(config, severity, payload);
}

/** Manually forward a trap (ignores severity filter and source toggles). Use when user explicitly requests forward. */
export async function forwardTrapManually(
  severity: string,
  payload: {
    title?: string;
    description?: string;
    message?: string;
    source?: string;
    siteName?: string;
    affectedSites?: string[];
    errorCode?: string;
    [key: string]: unknown;
  }
): Promise<{ success: boolean; error?: string }> {
  const config = getSnmpConfig();
  if (!config.enabled || !config.host?.trim()) {
    return { success: false, error: 'SNMP forwarding disabled or host not configured. Enable in Admin → SNMP Traps.' };
  }
  return sendTrap(config, severity, payload);
}

function sendTrap(
  config: SnmpTrapConfig,
  severity: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const trapPayload = {
    severity,
    message: payload.description || payload.message || payload.title || 'Alert',
    title: payload.title,
    source: payload.source || payload.siteName || 'LogSentinel',
    siteName: payload.siteName,
    affectedSites: payload.affectedSites,
    errorCode: payload.errorCode,
    timestamp: new Date().toISOString()
  };

  if (isElectron()) {
    return sendViaElectron(config, trapPayload);
  }
  return sendViaApi(config, trapPayload);
}
