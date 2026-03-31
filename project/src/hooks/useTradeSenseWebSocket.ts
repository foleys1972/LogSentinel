/**
 * TradeSense WBA (WebSocket Backend API) client.
 * Matches API document: TradeSense WBA 10.0.14
 *
 * Commands: auth, get_zones, get_tpos, get_health_api_report, subscribe, unsubscribe
 * Response: { command: "response", command_ref, success, data }
 * Notify:   { command: "notify", data: { category, events } }
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// --- Types matching TradeSense WBA API ---

export interface TradeSenseZone {
  id: string;
  name: string;
  locationCountryCode: string | null;
  locationRegion: string | null;
  locationCity: string | null;
  callPrefix: string | null;
}

export interface TradeSenseTPO {
  name: string;
  alive: boolean;
  tssVersion?: string;
  currentState?: string;
  ipAddress?: string;
  tpoDnsName: string;
  recordingServerEnabled: boolean;
  zone: string;
  clusterName: string;
  recordingServer?: {
    vendor: string;
    ipAddressPrimary: string | null;
    ipAddressSecondary: string | null;
  };
}

export interface TradeSenseHealthReport {
  reportName?: string;
  reportTime?: string;
  tradeSenseNodeName?: string;
  cluster_name?: string;
  platform?: Record<string, unknown>;
  zones?: Array<{
    name: string;
    tpoClusters?: Array<{
      name: string;
      tpos?: Array<Record<string, unknown>>;
      places?: Array<Record<string, unknown>>;
    }>;
    turrets?: Array<Record<string, unknown>>;
  }>;
  voiceRecorders?: Array<Record<string, unknown>>;
  pbxServers?: Array<Record<string, unknown>>;
  tradesenseNodeHealth?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TradeSenseNotifyEvent {
  event_id: number | null;
  turret?: string;
  zone?: string;
  login?: string;
  device?: string | null;
  microphone_state?: string | null;
  local_extension?: string;
  remote_extension?: string;
  call_direction?: string;
  call_ref?: string;
  state?: string;
  sip_call_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface TradeSenseNotifyData {
  category: 'calls' | 'presences' | 'alerts';
  events: TradeSenseNotifyEvent[];
  last_id?: number;
}

export interface TradeSenseState {
  isConnected: boolean;
  isAuthenticated: boolean;
  zones: TradeSenseZone[];
  tpos: TradeSenseTPO[];
  healthReport: TradeSenseHealthReport | null;
  notifications: Array<{ category: string; events: TradeSenseNotifyEvent[]; receivedAt: Date }>;
  lastError: string | null;
  reconnectAttempts: number;
}

const STORAGE_KEY = 'tradeSenseWebSocketConfig';
const DEFAULT_WS_URL = 'wss://TradeSenseFQDN/api';

function generateCommandRef(): string {
  return String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

function coerceBatchNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function batchMetaFromMessage(message: Record<string, unknown>): { current: number | null; last: number | null } {
  const payload = message.data && typeof message.data === 'object' && !Array.isArray(message.data)
    ? (message.data as Record<string, unknown>)
    : {};

  const curInner = coerceBatchNum(payload.current_batch);
  const curEnv = coerceBatchNum(message.current_batch);
  const lastInner = coerceBatchNum(payload.last_batch);
  const lastEnv = coerceBatchNum(message.last_batch);

  const current = curInner !== null ? curInner : curEnv;
  const last = lastInner !== null && lastEnv !== null
    ? Math.max(lastInner, lastEnv)
    : (lastInner !== null ? lastInner : lastEnv);

  return { current, last };
}

function mergeBatchPayload(acc: unknown, incoming: unknown): unknown {
  if (!incoming || typeof incoming !== 'object') return acc;
  if (!acc || typeof acc !== 'object') return incoming;
  if (Array.isArray(incoming)) return incoming;

  const a = acc as Record<string, unknown>;
  const b = incoming as Record<string, unknown>;
  const out: Record<string, unknown> = { ...a };

  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    if (Array.isArray(prev) && Array.isArray(v)) {
      out[k] = [...prev, ...v];
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface UseTradeSenseWebSocketOptions {
  onMessage?: (rawMessage: string) => void;
  /** When true, do not auto-connect on mount (for per-site mode where user clicks Connect) */
  skipAutoConnect?: boolean;
  /** When false, do not auto-reconnect on connection close (default: true) */
  autoReconnect?: boolean;
}

export function useTradeSenseWebSocket(wsUrl?: string | null, token?: string | null, options?: UseTradeSenseWebSocketOptions) {
  const onMessageRef = useRef(options?.onMessage);
  onMessageRef.current = options?.onMessage;
  const [state, setState] = useState<TradeSenseState>({
    isConnected: false,
    isAuthenticated: false,
    zones: [],
    tpos: [],
    healthReport: null,
    notifications: [],
    lastError: null,
    reconnectAttempts: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const autoReconnectRef = useRef(options?.autoReconnect ?? true);
  autoReconnectRef.current = options?.autoReconnect ?? true;
  const pendingCommandsRef = useRef<Map<string, (data: unknown) => void>>(new Map());
  const pendingBatchesRef = useRef<Map<string, { last: number | null; mergedData: unknown }>>(new Map());
  const authCommandRef = useRef<string | null>(null);
  const urlRef = useRef(wsUrl ?? loadSavedConfig().url);
  const tokenRef = useRef(token ?? loadSavedConfig().token);

  const maxReconnectAttempts = 10;
  const reconnectInterval = 3000;

  function loadSavedConfig(): { url: string; token: string } {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = JSON.parse(saved);
        return { url: config.url || DEFAULT_WS_URL, token: config.token || '' };
      }
    } catch {
      /* ignore */
    }
    return { url: DEFAULT_WS_URL, token: '' };
  }

  function saveConfig(url: string, tok: string) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, token: tok }));
    } catch {
      /* ignore */
    }
  }

  const sendCommand = useCallback(
    <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not connected'));
          return;
        }
        const commandRef = generateCommandRef();
        const msg = JSON.stringify({
          command,
          command_ref: commandRef,
          args: args ?? {}
        });
        pendingCommandsRef.current.set(commandRef, (data) => resolve(data as T));
        pendingBatchesRef.current.delete(commandRef);
        wsRef.current.send(msg);
        // Timeout after 30s
        setTimeout(() => {
          if (pendingCommandsRef.current.has(commandRef)) {
            pendingCommandsRef.current.delete(commandRef);
            pendingBatchesRef.current.delete(commandRef);
            reject(new Error(`Command ${command} timed out`));
          }
        }, 30000);
      });
    },
    []
  );

  const auth = useCallback(
    async (tok: string) => {
      const result = await sendCommand<{ success?: boolean }>('auth', { token: tok });
      if (result && (result as { success?: boolean }).success !== false) {
        tokenRef.current = tok;
        setState((prev) => ({ ...prev, isAuthenticated: true, lastError: null }));
        return true;
      }
      return false;
    },
    [sendCommand]
  );

  const getZones = useCallback(async () => {
    const result = await sendCommand<{ zones?: TradeSenseZone[] }>('get_zones', {});
    const zones = result?.zones ?? [];
    setState((prev) => ({ ...prev, zones }));
    return zones;
  }, [sendCommand]);

  const getTpos = useCallback(async () => {
    const result = await sendCommand<{ tpos?: TradeSenseTPO[] }>('get_tpos', {});
    const tpos = result?.tpos ?? [];
    setState((prev) => ({ ...prev, tpos }));
    return tpos;
  }, [sendCommand]);

  const getHealthApiReport = useCallback(
    async (includeAlerts = false) => {
      const args = includeAlerts ? { include: 'alerts' } : {};
      const result = await sendCommand<TradeSenseHealthReport>('get_health_api_report', args);
      if (result) {
        setState((prev) => ({ ...prev, healthReport: result }));
        return result;
      }
      return null;
    },
    [sendCommand]
  );

  const runCommand = useCallback(
    async (command: string, args: Record<string, unknown> = {}) => {
      return sendCommand(command, args);
    },
    [sendCommand]
  );

  const subscribe = useCallback(
    async (category: 'calls' | 'presences' | 'alerts') => {
      const result = await sendCommand<{ category: string; last_id?: number }>('subscribe', {
        category
      });
      return result;
    },
    [sendCommand]
  );

  const unsubscribe = useCallback(
    async (category: 'calls' | 'presences' | 'alerts') => {
      await sendCommand('unsubscribe', { category });
    },
    [sendCommand]
  );

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    pendingCommandsRef.current.clear();
    pendingBatchesRef.current.clear();
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isAuthenticated: false,
      lastError: 'Disconnected'
    }));
  }, []);

  const connect = useCallback(
    (url: string, tok: string) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const effectiveUrl = url || urlRef.current;
      const effectiveToken = tok || tokenRef.current;

      if (!effectiveUrl || effectiveUrl === DEFAULT_WS_URL) {
        setState((prev) => ({
          ...prev,
          lastError: 'Configure WebSocket URL (e.g. wss://TradeSenseFQDN/api)'
        }));
        return;
      }

      if (!effectiveToken) {
        setState((prev) => ({
          ...prev,
          lastError: 'Configure API token (from Assure admin)'
        }));
        return;
      }

      urlRef.current = effectiveUrl;
      tokenRef.current = effectiveToken;
      saveConfig(effectiveUrl, effectiveToken);
      setState((prev) => ({ ...prev, lastError: null }));

      try {
        const ws = new WebSocket(effectiveUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setState((prev) => ({
            ...prev,
            isConnected: true,
            lastError: null,
            reconnectAttempts: 0
          }));

          // Auth immediately per API doc (mandatory)
          const authRef = generateCommandRef();
          authCommandRef.current = authRef;
          ws.send(
            JSON.stringify({
              command: 'auth',
              command_ref: authRef,
              args: { token: effectiveToken }
            })
          );
        };

        ws.onmessage = (event) => {
          const rawData = event.data as string;
          onMessageRef.current?.(rawData);
          try {
            const msg = JSON.parse(rawData) as Record<string, unknown>;
            const cmd = msg.command;

            if (cmd === 'response' || cmd === 'return') {
              const commandRef = String(msg.command_ref ?? '');
              const isAuthResponse = commandRef === authCommandRef.current;
              if (isAuthResponse) {
                authCommandRef.current = null;
                if (msg.success) {
                  setState((prev) => ({ ...prev, isAuthenticated: true, lastError: null }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    lastError: msg.error?.message || msg.error?.reason || 'Auth failed'
                  }));
                }
              } else {
                const handler = pendingCommandsRef.current.get(commandRef);
                if (handler) {
                  if (msg.success === false) {
                    pendingCommandsRef.current.delete(commandRef);
                    pendingBatchesRef.current.delete(commandRef);
                    handler(null);
                  } else {
                    const data = msg.data;
                    const { current, last } = batchMetaFromMessage(msg);
                    const isBatched = current !== null || last !== null;
                    if (isBatched) {
                      const existing = pendingBatchesRef.current.get(commandRef) || { last: null, mergedData: null };
                      const mergedData = mergeBatchPayload(existing.mergedData, data);
                      const lastFinal = existing.last !== null && last !== null ? Math.max(existing.last, last) : (existing.last ?? last);
                      pendingBatchesRef.current.set(commandRef, { last: lastFinal, mergedData });

                      const currentFinal = current ?? 1;
                      const resolvedLast = lastFinal ?? currentFinal;
                      if (currentFinal >= resolvedLast) {
                        pendingCommandsRef.current.delete(commandRef);
                        pendingBatchesRef.current.delete(commandRef);
                        handler(mergedData);
                      }
                    } else {
                      pendingCommandsRef.current.delete(commandRef);
                      pendingBatchesRef.current.delete(commandRef);
                      handler(data);
                    }
                  }
                }
                if (msg.success === false && msg.error) {
                  setState((prev) => ({
                    ...prev,
                    lastError: msg.error?.message || msg.error?.reason || msg.error?.code || 'Request failed'
                  }));
                }
              }
              return;
            }

            if (cmd === 'notify') {
              const data = msg.data as TradeSenseNotifyData;
              if (data?.category && Array.isArray(data.events)) {
                setState((prev) => ({
                  ...prev,
                  notifications: [
                    ...prev.notifications,
                    { category: data.category, events: data.events, receivedAt: new Date() }
                  ].slice(-100)
                }));
              }
              return;
            }
          } catch {
            /* ignore non-JSON */
          }
        };

        ws.onerror = () => {
          setState((prev) => ({ ...prev, lastError: 'WebSocket error' }));
        };

        ws.onclose = () => {
          wsRef.current = null;
          pendingCommandsRef.current.clear();
          setState((prev) => ({ ...prev, isConnected: false, isAuthenticated: false }));

          if (!autoReconnectRef.current) return;
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            setState((prev) => ({ ...prev, reconnectAttempts: reconnectAttemptsRef.current }));
            reconnectTimeoutRef.current = setTimeout(
              () => connect(effectiveUrl, effectiveToken),
              reconnectInterval
            );
          } else {
            setState((prev) => ({
              ...prev,
              lastError: `Connection lost after ${maxReconnectAttempts} attempts`
            }));
          }
        };
      } catch (err) {
        setState((prev) => ({
          ...prev,
          lastError: err instanceof Error ? err.message : 'Failed to connect'
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (options?.skipAutoConnect) {
      return () => disconnect();
    }
    const url = wsUrl ?? urlRef.current;
    const tok = token ?? tokenRef.current;
    if (url && url !== DEFAULT_WS_URL && tok) {
      connect(url, tok);
    }
    return () => disconnect();
  }, [wsUrl, token, connect, disconnect, options?.skipAutoConnect]);

  const clearNotifications = useCallback(() => {
    setState((prev) => ({ ...prev, notifications: [] }));
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    auth,
    getZones,
    getTpos,
    getHealthApiReport,
    runCommand,
    subscribe,
    unsubscribe,
    clearNotifications,
    setConfig: (url: string, tok: string) => {
      urlRef.current = url;
      tokenRef.current = tok;
      saveConfig(url, tok);
    }
  };
}
