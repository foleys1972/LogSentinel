/**
 * Real HTTP health checks for monitoring integrations (browser fetch).
 * CORS may block cross-origin calls; failures distinguish network vs CORS where possible.
 */

export type MonitoringIntegrationType = 'telegraf' | 'influxdb' | 'prometheus' | 'grafana';

export interface MonitoringTestCredentials {
  username?: string;
  password?: string;
  token?: string;
  database?: string;
}

export interface MonitoringTestInput {
  type: MonitoringIntegrationType;
  endpoint: string;
  credentials: MonitoringTestCredentials;
}

export interface MonitoringTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10000;

function normalizeBaseUrl(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error('Endpoint URL is required');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

function authHeaders(
  type: MonitoringIntegrationType,
  credentials: MonitoringTestCredentials
): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const { username, password, token } = credentials;

  if (type === 'prometheus' || type === 'grafana') {
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  if (token) {
    headers.Authorization = `Token ${token}`;
    return headers;
  }

  if (username) {
    const secret = password ?? '';
    headers.Authorization = `Basic ${btoa(`${username}:${secret}`)}`;
  }

  return headers;
}

async function fetchProbe(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; latencyMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const latencyMs = Math.round(performance.now() - started);
    return { ok: res.ok, status: res.status, latencyMs };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Connection timed out after ${timeoutMs / 1000}s`);
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|cors|networkerror/i.test(msg)) {
      throw new Error(
        'Browser could not reach the endpoint (network error or CORS). Run LogSentinel server-side or allow CORS on the monitoring API.'
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

async function testInfluxEndpoint(
  base: string,
  credentials: MonitoringTestCredentials,
  label: string
): Promise<MonitoringTestResult> {
  const headers = authHeaders('influxdb', credentials);

  const healthUrl = `${base}/health`;
  try {
    const health = await fetchProbe(healthUrl, { method: 'GET', headers, mode: 'cors' });
    if (health.ok) {
      return {
        success: true,
        message: `${label}: /health OK (HTTP ${health.status})`,
        latencyMs: health.latencyMs
      };
    }
  } catch {
    /* try v1 ping */
  }

  const ping = await fetchProbe(`${base}/ping`, { method: 'GET', headers, mode: 'cors' });
  if (ping.ok || ping.status === 204) {
    return {
      success: true,
      message: `${label}: /ping OK (HTTP ${ping.status})`,
      latencyMs: ping.latencyMs
    };
  }

  return {
    success: false,
    message: `${label}: unreachable (HTTP ${ping.status} on /ping)`,
    latencyMs: ping.latencyMs
  };
}

async function testPrometheus(base: string, credentials: MonitoringTestCredentials): Promise<MonitoringTestResult> {
  const headers = authHeaders('prometheus', credentials);
  const ready = await fetchProbe(`${base}/-/ready`, { method: 'GET', headers, mode: 'cors' });
  if (ready.ok) {
    return {
      success: true,
      message: `Prometheus ready (HTTP ${ready.status})`,
      latencyMs: ready.latencyMs
    };
  }

  const healthy = await fetchProbe(`${base}/-/healthy`, { method: 'GET', headers, mode: 'cors' });
  if (healthy.ok) {
    return {
      success: true,
      message: `Prometheus healthy (HTTP ${healthy.status})`,
      latencyMs: healthy.latencyMs
    };
  }

  return {
    success: false,
    message: `Prometheus not ready (HTTP ${ready.status} on /-/ready)`,
    latencyMs: ready.latencyMs
  };
}

async function testGrafana(base: string, credentials: MonitoringTestCredentials): Promise<MonitoringTestResult> {
  const headers = authHeaders('grafana', credentials);
  const health = await fetchProbe(`${base}/api/health`, { method: 'GET', headers, mode: 'cors' });
  if (health.ok) {
    return {
      success: true,
      message: `Grafana health OK (HTTP ${health.status})`,
      latencyMs: health.latencyMs
    };
  }
  return {
    success: false,
    message: `Grafana health check failed (HTTP ${health.status})`,
    latencyMs: health.latencyMs
  };
}

export async function testMonitoringConnection(input: MonitoringTestInput): Promise<MonitoringTestResult> {
  const base = normalizeBaseUrl(input.endpoint);
  const { type, credentials } = input;

  try {
    switch (type) {
      case 'influxdb':
        return await testInfluxEndpoint(base, credentials, 'InfluxDB');
      case 'telegraf':
        return await testInfluxEndpoint(
          base,
          credentials,
          'Telegraf output target (InfluxDB URL)'
        );
      case 'prometheus':
        return await testPrometheus(base, credentials);
      case 'grafana':
        return await testGrafana(base, credentials);
      default:
        return { success: false, message: `Unknown integration type: ${type}` };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Connection test failed'
    };
  }
}
