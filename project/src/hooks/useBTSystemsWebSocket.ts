import { useState, useEffect, useCallback, useRef } from 'react';
import type { BTSystemHealthReport, BTSystemStatus } from '../types';

export interface BTSystemsWebSocketState {
  isConnected: boolean;
  healthReports: BTSystemHealthReport[];
  systemStatuses: BTSystemStatus[];
  lastMessage: string | null;
  error: string | null;
  reconnectAttempts: number;
}

const DEFAULT_WS_URL = 'wss://your-bt-systems-api.example.com/ws/health';
const STORAGE_KEY = 'btSystemsWebSocketConfig';

function parseHealthReport(data: unknown): BTSystemHealthReport | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const systemId = String(obj.systemId ?? obj.system_id ?? obj.id ?? '');
  const systemName = String(obj.systemName ?? obj.system_name ?? obj.name ?? systemId);
  if (!systemId) return null;

  const timestamp = obj.timestamp
    ? new Date(typeof obj.timestamp === 'number' ? obj.timestamp * 1000 : obj.timestamp)
    : new Date();

  let healthScore = 100;
  if (typeof obj.healthScore === 'number') healthScore = obj.healthScore;
  else if (typeof obj.health_score === 'number') healthScore = obj.health_score;

  let status: BTSystemHealthReport['status'] = 'healthy';
  const statusStr = String(obj.status ?? obj.health ?? '').toLowerCase();
  if (['healthy', 'warning', 'critical', 'offline', 'maintenance'].includes(statusStr)) {
    status = statusStr as BTSystemHealthReport['status'];
  } else if (healthScore >= 80) status = 'healthy';
  else if (healthScore >= 50) status = 'warning';
  else if (healthScore > 0) status = 'critical';
  else status = 'offline';

  const components = Array.isArray(obj.components)
    ? (obj.components as unknown[]).map((c: unknown) => {
        const comp = c as Record<string, unknown>;
        const statusStr = String(comp.status ?? '').toLowerCase();
        const compStatus: 'ok' | 'degraded' | 'failed' | 'unknown' =
          ['ok', 'degraded', 'failed', 'unknown'].includes(statusStr)
            ? (statusStr as 'ok' | 'degraded' | 'failed' | 'unknown')
            : 'unknown';
        const compValue = typeof comp.value === 'number' ? comp.value : undefined;
        return {
          name: String(comp.name ?? comp.component ?? 'Unknown'),
          status: compStatus,
          value: compValue,
          unit: comp.unit ? String(comp.unit) : undefined,
          message: comp.message ? String(comp.message) : undefined
        };
      })
    : [];

  const metrics = obj.metrics && typeof obj.metrics === 'object' && !Array.isArray(obj.metrics)
    ? (obj.metrics as Record<string, number>)
    : undefined;

  return {
    systemId,
    systemName,
    timestamp,
    healthScore,
    status,
    components,
    metrics,
    lastReported: timestamp
  };
}

function parseSystemStatus(data: unknown): BTSystemStatus | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const systemId = String(obj.systemId ?? obj.system_id ?? obj.id ?? '');
  const systemName = String(obj.systemName ?? obj.system_name ?? obj.name ?? systemId);
  if (!systemId) return null;

  const timestamp = obj.timestamp
    ? new Date(typeof obj.timestamp === 'number' ? obj.timestamp * 1000 : obj.timestamp)
    : new Date();

  const online = obj.online !== undefined ? Boolean(obj.online) : obj.status === 'online';

  return {
    systemId,
    systemName,
    timestamp,
    online,
    latencyMs: typeof obj.latencyMs === 'number' ? obj.latencyMs : obj.latency_ms as number | undefined,
    message: obj.message ? String(obj.message) : undefined,
    version: obj.version ? String(obj.version) : undefined
  };
}

export interface UseBTSystemsWebSocketOptions {
  onMessage?: (rawMessage: string) => void;
  /** When true, do not auto-connect on mount (for per-site mode where user clicks Connect) */
  skipAutoConnect?: boolean;
}

export function useBTSystemsWebSocket(wsUrl?: string | null, options?: UseBTSystemsWebSocketOptions) {
  const onMessageRef = useRef(options?.onMessage);
  onMessageRef.current = options?.onMessage;
  const [state, setState] = useState<BTSystemsWebSocketState>({
    isConnected: false,
    healthReports: [],
    systemStatuses: [],
    lastMessage: null,
    error: null,
    reconnectAttempts: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const urlRef = useRef(wsUrl ?? loadSavedUrl());

  const maxReconnectAttempts = 10;
  const reconnectInterval = 3000;

  function loadSavedUrl(): string {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        return config.url || DEFAULT_WS_URL;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_WS_URL;
  }

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false, error: 'Disconnected' }));
  }, []);

  const connect = useCallback((url: string) => {
    // Disconnect existing connection if connecting to (possibly) new URL
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const effectiveUrl = url || urlRef.current;
    if (!effectiveUrl || effectiveUrl === DEFAULT_WS_URL) {
      setState(prev => ({ ...prev, error: 'Configure WebSocket URL in BT Systems panel' }));
      return;
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      const ws = new WebSocket(effectiveUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          reconnectAttempts: 0
        }));
      };

      ws.onmessage = (event) => {
        const rawData = event.data as string;
        onMessageRef.current?.(rawData);
        try {
          const data = JSON.parse(rawData);
          setState(prev => ({ ...prev, lastMessage: rawData }));

          // Try to parse as health report
          const healthReport = parseHealthReport(data);
          if (healthReport) {
            setState(prev => ({
              ...prev,
              healthReports: [
                ...prev.healthReports.filter(r => r.systemId !== healthReport.systemId),
                healthReport
              ].slice(-50) // Keep last 50 reports
            }));
            return;
          }

          // Try to parse as status
          const status = parseSystemStatus(data);
          if (status) {
            setState(prev => ({
              ...prev,
              systemStatuses: [
                ...prev.systemStatuses.filter(s => s.systemId !== status.systemId),
                status
              ].slice(-50)
            }));
            return;
          }

          // Handle array of reports/statuses
          if (Array.isArray(data)) {
            for (const item of data) {
              const hr = parseHealthReport(item);
              if (hr) {
                setState(prev => ({
                  ...prev,
                  healthReports: [
                    ...prev.healthReports.filter(r => r.systemId !== hr.systemId),
                    hr
                  ].slice(-50)
                }));
              }
              const st = parseSystemStatus(item);
              if (st) {
                setState(prev => ({
                  ...prev,
                  systemStatuses: [
                    ...prev.systemStatuses.filter(s => s.systemId !== st.systemId),
                    st
                  ].slice(-50)
                }));
              }
            }
          }
        } catch {
          // Non-JSON or unparseable message - ignore
        }
      };

      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'WebSocket error' }));
      };

      ws.onclose = () => {
        wsRef.current = null;
        setState(prev => ({ ...prev, isConnected: false }));

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          setState(prev => ({ ...prev, reconnectAttempts: reconnectAttemptsRef.current }));
          reconnectTimeoutRef.current = setTimeout(() => connect(effectiveUrl), reconnectInterval);
        } else {
          setState(prev => ({
            ...prev,
            error: `Connection lost after ${maxReconnectAttempts} reconnect attempts`
          }));
        }
      };
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to connect'
      }));
    }
  }, []);

  useEffect(() => {
    if (skipAutoConnect) {
      return () => disconnect();
    }
    const url = wsUrl ?? urlRef.current;
    if (url && url !== DEFAULT_WS_URL) {
      connect(url);
    }
    return () => disconnect();
  }, [wsUrl, connect, disconnect, skipAutoConnect]);

  const clearReports = useCallback(() => {
    setState(prev => ({
      ...prev,
      healthReports: [],
      systemStatuses: [],
      lastMessage: null
    }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    clearReports,
    setUrl: (url: string) => {
      urlRef.current = url;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ url }));
      } catch {
        /* ignore */
      }
    }
  };
}
