# LogSentinel MCP Integration

Connect LogSentinel to **Cursor**, **Claude Desktop**, or any [Model Context Protocol](https://modelcontextprotocol.io/) client so an LLM can read logs, baselines, and run AI analysis through your running LogSentinel server.

## Architecture

```
LLM (Cursor)  ←stdio→  logsentinel-mcp-server.cjs  ←HTTP→  LogSentinel server.cjs
                                                              /api/mcp/*
```

## 1. Enable the MCP API (in the app)

1. Open **Settings** (gear) → **MCP Integration** tab.
2. Turn on **Enable MCP API**.
3. Click **Generate key** (or paste your own), then **Save**.
4. Copy the API key and the **Cursor MCP configuration** JSON shown on that page.
5. Use **Test** to confirm the API responds.

Settings are stored in `project/data/mcp-config.json` on the server.

### Alternative: environment variable

Set `LOGSENTINEL_MCP_API_KEY` on the server before start (still works alongside UI settings):

**Windows (PowerShell):**
```powershell
$env:LOGSENTINEL_MCP_API_KEY = "your-long-random-secret-here"
cd C:\Projects\LogSentinel\project
npm start
```

## 2. Install MCP server dependency

```powershell
cd C:\Projects\LogSentinel\project
npm install
```

This installs `@modelcontextprotocol/sdk` (used by `mcp/logsentinel-mcp-server.cjs`).

## 3. Configure Cursor

Copy `project/mcp/cursor-mcp.example.json` into your Cursor MCP config ( **Cursor Settings → MCP → Edit config** ), or merge into `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "logsentinel": {
      "command": "node",
      "args": ["C:/Projects/LogSentinel/project/mcp/logsentinel-mcp-server.cjs"],
      "env": {
        "LOGSENTINEL_URL": "http://localhost:3000",
        "LOGSENTINEL_MCP_API_KEY": "your-long-random-secret-here"
      }
    }
  }
}
```

Use the **same API key** on the server and in the MCP env. Adjust paths and port if needed.

Restart Cursor after saving.

## 4. Verify

1. LogSentinel server running with `LOGSENTINEL_MCP_API_KEY` set.
2. At least one browser client connected with sites configured (so logs flow into the server ML buffer).
3. In Cursor, ask: *"Use logsentinel_status to check if LogSentinel is connected."*

## MCP Tools

| Tool | Description |
|------|-------------|
| `logsentinel_status` | Server health, log count, active modules |
| `logsentinel_get_logs` | Recent logs with filters (site, level, search, time) |
| `logsentinel_search_logs` | Regex search over log messages |
| `logsentinel_get_baselines` | ML baselines and learned patterns |
| `logsentinel_service_improvement` | LLM service improvement analysis (requires LLM configured in Admin) |
| `logsentinel_suggest_baselines` | LLM-suggested baseline updates; optional `apply: true` |

## REST API (direct)

All endpoints require header `Authorization: Bearer <LOGSENTINEL_MCP_API_KEY>`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/mcp/status` | Status snapshot |
| GET | `/api/mcp/logs?limit=50&level=critical` | Filtered logs |
| POST | `/api/mcp/search-logs` | Body: `{ "pattern": "ERROR.*timeout" }` |
| GET | `/api/mcp/baselines` | ML baselines |
| POST | `/api/mcp/service-improvement` | LLM analysis |
| POST | `/api/mcp/update-baselines` | Body: `{ "apply": false }` |

## Run MCP server manually (debug)

```powershell
$env:LOGSENTINEL_URL = "http://localhost:3000"
$env:LOGSENTINEL_MCP_API_KEY = "your-secret"
npm run mcp:server
```

## Notes

- **Logs** come from the server-side ML buffer (populated when the web UI connects and folder monitoring is active). Sites are still stored in the browser; configure monitoring in the UI first.
- **LLM tools** require AI/LLM configured under Admin → AI / LLM.
- Use a strong random API key in production; the MCP API bypasses session login when the key is valid.
