# TradeSense WBA API – Implementation vs Document

Reference: `C:\Projects\VoiceBot\backend-dotnet\External\TradeSense WBA 10.0.14 - Unknown.txt`

## Summary

| API | Document | Previous (useBTSystemsWebSocket) | New (useTradeSenseWebSocket) |
|-----|----------|----------------------------------|------------------------------|
| **Health check** | `get_health_api_report` command | ❌ Not implemented | ✅ Implemented |
| **Get Zones** | `get_zones` command | ❌ Not implemented | ✅ Implemented |
| **Get TPOs** | `get_tpos` command | ❌ Not implemented | ✅ Implemented |
| **Subscribe to events** | `subscribe` with `args.category` | ❌ Not implemented | ✅ Implemented |
| **Auth** | `auth` with `args.token` (mandatory) | ❌ Not implemented | ✅ Implemented |

---

## 1. Health Check API

### Document

```
command: "get_health_api_report"
command_ref: "command reference"
args: {}  // or {"include":"alerts"} for alerts data
```

Response: `data` contains reportName, reportTime, zones, tpoClusters, tpos, turrets, voiceRecorders, pbxServers, tradesenseNodeHealth, etc.

### Implementation

- **useTradeSenseWebSocket**: `getHealthApiReport(includeAlerts?: boolean)` sends the correct command and optional `args: { include: "alerts" }`.
- Parses `response` format: `{ command: "response", success, data }`.

---

## 2. Get Zones

### Document

```
command: "get_zones"
command_ref: "command reference"
args: {}  // or { search, operator, limit } for optional filters
```

Response: `data.zones` array of `{ id, name, locationCountryCode, locationRegion, locationCity, callPrefix }`.

### Implementation

- **useTradeSenseWebSocket**: `getZones()` sends `get_zones` with empty args.
- Stores zones in state; types match document.

---

## 3. Get TPOs

### Document

```
command: "get_tpos"
command_ref: "command reference"
args: {}  // or { search, operator, limit } for optional filters
```

Response: `data.tpos` array of `{ name, alive, tssVersion, currentState, ipAddress, tpoDnsName, recordingServerEnabled, zone, clusterName, recordingServer }`.

### Implementation

- **useTradeSenseWebSocket**: `getTpos()` sends `get_tpos` with empty args.
- Stores tpos in state; types match document.

---

## 4. Subscribe to Events

### Document

```
command: "subscribe"
command_ref: "command reference"
args: { "category": "calls" }  // or "presences" or "alerts"
```

Response: `data: { category, last_id }`.

Notifications: `{ command: "notify", data: { category, events: [...] } }`.

Categories: `calls`, `presences`, `alerts`.

### Implementation

- **useTradeSenseWebSocket**: `subscribe(category)` and `unsubscribe(category)` send correct commands.
- Parses `notify` messages and stores events in state.

---

## 5. Authentication

### Document

```
command: "auth"
command_ref: "command reference"
args: { "token": "TOKEN" }
```

Auth is mandatory before other commands. Connect to `wss://TradeSenseFQDN/api`.

### Implementation

- **useTradeSenseWebSocket**: Sends `auth` immediately on `onopen` with token from config.
- Sets `isAuthenticated` when response `success === true`.

---

## 6. Message Formats

### Document

- **Command**: `{ command, command_ref, args }`
- **Response**: `{ command: "response", command_ref, success, data }` or `{ ..., success: false, error: { code, message, reason } }`
- **Notify**: `{ command: "notify", data: { category, events } }`

### Implementation

- All commands use `command`, `command_ref`, `args`.
- Response handler matches `command === "response"`.
- Notify handler matches `command === "notify"` and extracts `data.category`, `data.events`.

---

## Files

| File | Purpose |
|------|---------|
| `src/hooks/useTradeSenseWebSocket.ts` | TradeSense WBA client (auth, get_zones, get_tpos, get_health_api_report, subscribe, unsubscribe) |
| `src/components/advanced/TradeSensePanel.tsx` | UI for TradeSense: config, connect, fetch zones/TPOs/health, subscribe to events |
| `src/hooks/useBTSystemsWebSocket.ts` | Legacy passive WebSocket (receives pushed health/status; no commands) |
| `src/components/advanced/BTSystemsPanel.tsx` | UI for generic BT Systems WebSocket |

---

## Usage

1. Open TradeSense panel (teal Radio button).
2. Configure URL (`wss://TradeSenseFQDN/api`) and token (from Assure admin).
3. Click **Save & Connect**.
4. After authentication, use **Get Zones**, **Get TPOs**, **Get Health Report**.
5. Use **Sub calls**, **Sub presences**, **Sub alerts** to subscribe; notifications appear in the panel.
