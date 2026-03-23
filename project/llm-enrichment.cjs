/**
 * LLM enrichment - supports OpenAI, Mistral, Ollama, Azure (Copilot).
 * Config: .llm-config.json
 */

const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, '.llm-config.json');

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  azure: { baseUrl: '', model: '', deployment: '' }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const provider = data.provider || 'openai';
      const def = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
      return {
        enabled: data.enabled ?? false,
        provider: provider,
        apiKey: data.apiKey || process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY || '',
        model: data.model || def.model,
        baseUrl: data.baseUrl || def.baseUrl,
        deployment: data.deployment || def.deployment,
        continuousEvaluationEnabled: data.continuousEvaluationEnabled ?? false,
        continuousEvaluationPrompt: data.continuousEvaluationPrompt || '',
        continuousEvaluationIntervalMinutes: Math.max(1, Math.min(60, data.continuousEvaluationIntervalMinutes || 5))
      };
    }
  } catch (e) {
    /* ignore */
  }
  return {
    enabled: false,
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    deployment: '',
    continuousEvaluationEnabled: false,
    continuousEvaluationPrompt: '',
    continuousEvaluationIntervalMinutes: 5
  };
}

function saveConfig(config) {
  try {
    const toSave = {
      enabled: config.enabled,
      provider: config.provider || 'openai',
      model: config.model,
      apiKey: config.apiKey || undefined,
      baseUrl: config.baseUrl || undefined,
      deployment: config.deployment || undefined,
      continuousEvaluationEnabled: config.continuousEvaluationEnabled ?? false,
      continuousEvaluationPrompt: config.continuousEvaluationPrompt || '',
      continuousEvaluationIntervalMinutes: config.continuousEvaluationIntervalMinutes || 5
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2));
  } catch (e) {
    console.warn('[LLM] Could not save config:', e.message);
  }
}

async function callLLM(config, prompt, opts = {}) {
  const provider = config.provider || 'openai';
  const needsKey = provider !== 'ollama';
  if (!config.enabled || (needsKey && !config.apiKey?.trim())) return null;
  const maxTokens = opts.maxTokens ?? 500;

  let url, headers, body;
  if (provider === 'ollama') {
    const base = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    url = `${base}/v1/chat/completions`;
    headers = { 'Content-Type': 'application/json' };
    body = { model: config.model || 'llama3.2', messages: [{ role: 'user', content: prompt }], stream: false };
  } else if (provider === 'azure') {
    const base = (config.baseUrl || '').replace(/\/+$/, '');
    const dep = config.deployment || config.model;
    url = `${base}/openai/deployments/${dep}/chat/completions?api-version=2024-02-15-preview`;
    headers = { 'Content-Type': 'application/json', 'api-key': config.apiKey };
    body = { messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.3 };
  } else {
    const base = (config.baseUrl || (provider === 'mistral' ? 'https://api.mistral.ai/v1' : 'https://api.openai.com/v1')).replace(/\/+$/, '');
    url = `${base}/chat/completions`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };
    body = { model: config.model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.3 };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    console.warn('[LLM] API error:', res.status, err?.substring(0, 200));
    return null;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || data.message?.content?.trim() || null;
}

async function enrichAnomaly(anomaly) {
  const config = loadConfig();
  const needsKey = config.provider !== 'ollama';
  if (!config.enabled || (needsKey && !config.apiKey?.trim())) {
    return anomaly;
  }

  const prompt = `You are a log monitoring and incident response assistant. An anomaly was detected in a site monitoring system.

Anomaly details:
- Type: ${anomaly.type}
- Severity: ${anomaly.severity}
- Site: ${anomaly.siteName}
- Description: ${anomaly.description}
- Details: ${JSON.stringify(anomaly.details || {})}

Respond in JSON with exactly two keys:
1. "summary": A brief 1-2 sentence plain-language summary of what this anomaly means and why it matters.
2. "remediation": 2-4 bullet points for remediation steps (e.g. "Check X", "Restart Y").

Return only valid JSON, no markdown or extra text.`;

  try {
    const content = await callLLM(config, prompt);
    if (!content) return anomaly;

    let parsed;
    try {
      const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.warn('[LLM] Could not parse response:', content?.substring(0, 100));
      return anomaly;
    }

    const remediation = parsed.remediation;
    const remediationStr = Array.isArray(remediation)
      ? remediation.map((r) => (typeof r === 'string' ? r : `• ${r}`)).join('\n')
      : typeof remediation === 'string'
        ? remediation
        : undefined;

    return {
      ...anomaly,
      aiSummary: parsed.summary || anomaly.description,
      aiRemediation: remediationStr
    };
  } catch (e) {
    console.warn('[LLM] Enrichment failed:', e.message);
    return anomaly;
  }
}

function getConfigSafe() {
  const c = loadConfig();
  const needsKey = c.provider !== 'ollama';
  return {
    enabled: c.enabled,
    provider: c.provider || 'openai',
    model: c.model,
    hasApiKey: needsKey ? !!c.apiKey?.trim() : true,
    baseUrl: c.baseUrl,
    deployment: c.deployment,
    continuousEvaluationEnabled: c.continuousEvaluationEnabled ?? false,
    continuousEvaluationPrompt: c.continuousEvaluationPrompt || '',
    continuousEvaluationIntervalMinutes: c.continuousEvaluationIntervalMinutes || 5
  };
}

const MAX_LOGS_FOR_EVALUATION = 80;

async function runContinuousLogEvaluation(logs, onResult) {
  const config = loadConfig();
  const needsKey = config.provider !== 'ollama';
  if (!config.enabled || (needsKey && !config.apiKey?.trim())) return null;
  if (!config.continuousEvaluationEnabled || !config.continuousEvaluationPrompt?.trim()) return null;
  if (!logs || logs.length === 0) return null;

  const summary = logs.slice(-MAX_LOGS_FOR_EVALUATION).map((l) => ({
    timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
    level: l.level,
    site: l.siteName || l.siteId,
    message: (l.message || '').substring(0, 200),
    errorCode: l.errorCode,
    source: l.source
  }));

  const prompt = `${config.continuousEvaluationPrompt.trim()}

Evaluate the following recent logs. Provide a concise assessment (2-5 bullet points). Focus on patterns, risks, or actionable findings.

Recent logs (${summary.length} entries):
${JSON.stringify(summary, null, 2)}`;

  try {
    const content = await callLLM(config, prompt, { maxTokens: 800 });
    if (!content) return null;
    const result = { timestamp: new Date().toISOString(), evaluation: content, logCount: summary.length };
    if (typeof onResult === 'function') onResult(result);
    return result;
  } catch (e) {
    console.warn('[LLM] Continuous evaluation failed:', e.message);
    return null;
  }
}

async function suggestBaselineUpdates(context) {
  const config = loadConfig();
  const needsKey = config.provider !== 'ollama';
  if (!config.enabled || (needsKey && !config.apiKey?.trim())) {
    return { success: false, error: 'AI not configured. Enable in Admin → AI/LLM.' };
  }

  const knownErrors = context.knownErrorPatterns || {};
  const knownMessages = context.knownMessagePatterns || {};
  const knownErrorKeys = Object.keys(knownErrors).slice(0, 50);
  const knownMessageKeys = Object.keys(knownMessages).slice(0, 50);

  const prompt = `You are a log monitoring and ML baseline assistant. Suggest additions to known patterns so the system stops flagging them as anomalies.

Context:
- Recent anomalies: ${JSON.stringify((context.anomalies || []).slice(0, 5).map((a) => ({ type: a.type, description: a.description, details: a.details })))}
- Sample log messages (last 20): ${JSON.stringify((context.recentLogs || []).slice(-20).map((l) => ({ level: l.level, message: (l.message || '').substring(0, 200), errorCode: l.errorCode, source: l.source })))}
- Known error patterns (source_errorCode): ${JSON.stringify(knownErrorKeys)}
- Known message patterns (source_signature): ${JSON.stringify(knownMessageKeys)}

Do not suggest patterns already in the known lists. Suggest new patterns from the sample logs to reduce false positives. For error codes: use source + errorCode (e.g. "app.log_ERR123"). For message patterns: use a short keyword signature in UPPER_SNAKE_CASE (e.g. "TIMEOUT_FAILED", "CONNECTION_REFUSED") from the log message.

Respond in JSON only:
{
  "addKnownErrorPatterns": [{"source": "unknown", "errorCode": "ERR123"}],
  "addKnownMessagePatterns": [{"source": "unknown", "signature": "TIMEOUT_FAILED"}]
}
Use empty arrays if no suggestions. Return only valid JSON.`;

  try {
    const content = await callLLM(config, prompt, { maxTokens: 600 });
    if (!content) return { success: false, error: 'No response from AI' };
    const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      success: true,
      suggestions: {
        addKnownErrorPatterns: Array.isArray(parsed.addKnownErrorPatterns) ? parsed.addKnownErrorPatterns : [],
        addKnownMessagePatterns: Array.isArray(parsed.addKnownMessagePatterns) ? parsed.addKnownMessagePatterns : []
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getServiceImprovementSuggestions(context) {
  const config = loadConfig();
  const needsKey = config.provider !== 'ollama';
  if (!config.enabled || (needsKey && !config.apiKey?.trim())) {
    return { success: false, error: 'AI not configured. Enable in Admin → AI/LLM.' };
  }

  const prompt = `You are a log monitoring and service improvement assistant. Review this analysis and suggest fixes.

Context:
- Total logs: ${context.totalLogs || 0}
- Critical/high alerts: ${context.criticalLogs || 0}
- ML anomalies: ${context.anomalies || 0}
- Top concerns: ${JSON.stringify(context.concerns || [])}
- Fix recommendations: ${JSON.stringify(context.fixRecommendations || [])}

Provide 3-5 prioritized action items to reduce alerts and improve service health. Be specific and actionable.
Respond in JSON: { "actions": ["action 1", "action 2", ...] }
Return only valid JSON.`;

  try {
    const content = await callLLM(config, prompt);
    if (!content) return { success: false, error: 'No response from AI' };
    const cleaned = content.replace(/^```json\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { success: true, actions: parsed.actions || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  enrichAnomaly,
  loadConfig,
  saveConfig,
  getConfigSafe,
  getServiceImprovementSuggestions,
  runContinuousLogEvaluation,
  suggestBaselineUpdates
};
