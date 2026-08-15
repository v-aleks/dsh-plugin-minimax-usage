// Host bundle: registers /api/minimax/quota and /api/minimax/model-check.
// Sources MINIMAX_API_KEY via ~/.zshrc.secret, then calls
//   GET https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains
// Returns { fiveHour, weekly } with remaining percentages and reset countdowns.

const CACHE_TTL_MS = 60 * 1000;
const ENDPOINT = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';

let cache = null; // { at: number, data: any }

function toIso(unixMs) {
  return new Date(unixMs).toISOString();
}

function pickFirstModel(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const list = Array.isArray(payload.model_remains) ? payload.model_remains : null;
  if (!list || list.length === 0) return null;
  return list[0];
}

function mapRow(row) {
  const nowMs = Date.now();
  const fhResetMs = (typeof row.end_time === 'number') ? (row.end_time - nowMs) : null;
  const wkResetMs = (typeof row.weekly_end_time === 'number') ? (row.weekly_end_time - nowMs) : null;

  return {
    model_name: row.model_name,
    fiveHour: {
      remaining_percent: row.current_interval_remaining_percent,
      used_percent: 100 - row.current_interval_remaining_percent,
      period: (row.start_time && row.end_time)
        ? toIso(row.start_time).slice(0, 16) + ' → ' + toIso(row.end_time).slice(0, 16)
        : undefined,
      resets_in_ms: fhResetMs,
    },
    weekly: {
      remaining_percent: row.current_weekly_remaining_percent,
      used_percent: 100 - row.current_weekly_remaining_percent,
      period: (row.weekly_start_time && row.weekly_end_time)
        ? toIso(row.weekly_start_time).slice(0, 10) + ' → ' + toIso(row.weekly_end_time).slice(0, 10)
        : undefined,
      resets_in_ms: wkResetMs,
    },
  };
}

async function readApiKey(shell) {
  const spec = shell.resolve({
    command: 'source ~/.zshrc.secret 2>/dev/null; printf "%s" "${MINIMAX_API_KEY:-}"',
    timeoutMs: 3000,
  });
  const result = await shell.run(spec);
  const text = (result && result.stdout && typeof result.stdout.text === 'string')
    ? result.stdout.text : '';
  return text.trim();
}

async function fetchQuota(shell) {
  const apiKey = await readApiKey(shell);
  if (!apiKey) return { error: 'MINIMAX_API_KEY not set in ~/.zshrc.secret' };

  const safeKey = apiKey.replace(/'/g, "'\\''");
  const curlSpec = shell.resolve({
    command: '/usr/bin/curl -sS -m 10 -H \'Authorization: Bearer ' + safeKey +
             '\' -H \'Content-Type: application/json\' \'' + ENDPOINT + '\'',
    timeoutMs: 12000,
  });
  const curlResult = await shell.run(curlSpec);
  const exitCode = curlResult ? curlResult.exitCode : null;
  if (!curlResult || exitCode !== 0) {
    const stderrText = (curlResult && curlResult.stderr && typeof curlResult.stderr.text === 'string')
      ? curlResult.stderr.text : '';
    return {
      error: 'curl failed (exit ' + exitCode + '): ' + (stderrText || 'no result'),
    };
  }

  const stdout = (curlResult.stdout && typeof curlResult.stdout.text === 'string')
    ? curlResult.stdout.text : '';
  let parsed = null;
  try { parsed = JSON.parse(stdout); }
  catch (e) {
    return { error: 'invalid JSON: ' + String(e).slice(0, 120) + ' · first 80 bytes: ' + stdout.slice(0, 80) };
  }

  if (parsed.base_resp && parsed.base_resp.status_code !== 0) {
    return { error: 'API: ' + (parsed.base_resp.status_msg || 'error code ' + parsed.base_resp.status_code) };
  }

  const row = pickFirstModel(parsed);
  if (!row) return { error: 'no model_remains rows in response' };

  return mapRow(row);
}

// Check if the current default model is from MiniMax.
// Uses agentDefaultModel service to read the provider+model selection.
function isMiniMaxModel(ctx) {
  try {
    const adm = ctx.get('agentDefaultModel');
    if (!adm) return { isMiniMax: false, reason: 'agentDefaultModel service unavailable' };
    const sel = adm.currentSelection();
    if (!sel) return { isMiniMax: false, reason: 'no model selection' };
    const provider = (sel.provider || '').toLowerCase();
    const model = (sel.model || '').toLowerCase();
    // Match common MiniMax provider identifiers
    if (provider.includes('minimax') || model.includes('minimax')) {
      return { isMiniMax: true, provider: sel.provider, model: sel.model };
    }
    return { isMiniMax: false, provider: sel.provider, model: sel.model };
  } catch (e) {
    return { isMiniMax: false, reason: String(e && e.message || e) };
  }
}

module.exports = {
  inject: ['shell', 'webServer'],
  apply(ctx) {
    const webServer = ctx.webServer;
    if (!webServer) {
      console.error('[minimax-usage] webServer service unavailable; route not registered');
      return;
    }
    const shell = ctx.shell;
    if (!shell) {
      console.error('[minimax-usage] shell service unavailable; route not registered');
      return;
    }

    // Listen for model selection changes via settings/updated event.
    // When the model changes, the agent-default-model settings namespace is updated.
    // This lets us respond to manual model switches instantly (no polling delay).
    let lastModelCheck = null; // cached result to avoid re-computation
    ctx.on('settings/updated', (ns) => {
      // agent-default-model settings changed → invalidate cached model check
      if (ns && typeof ns === 'object' && ns.name === 'agent-default-model') {
        lastModelCheck = null;
      }
    });

    // Model-check endpoint: returns whether the current model is MiniMax
    webServer.register({
      kind: 'exact',
      path: '/api/minimax/model-check',
      handler: async (req, res) => {
        try {
          if (!lastModelCheck) {
            lastModelCheck = isMiniMaxModel(ctx);
          }
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(lastModelCheck));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ isMiniMax: false, error: String(e && e.message || e) }));
        }
      },
    });

    // Quota endpoint: returns MiniMax coding plan quota data
    webServer.register({
      kind: 'exact',
      path: '/api/minimax/quota',
      handler: async (req, res) => {
        try {
          const now = Date.now();
          if (cache && (now - cache.at) < CACHE_TTL_MS) {
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify(cache.data));
            return;
          }
          const data = await fetchQuota(shell);
          if (!data.error) {
            cache = { at: now, data };
          }
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(data));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(e && e.message || e) }));
        }
      },
    });

    console.log('[minimax-usage] /api/minimax/model-check + /api/minimax/quota routes registered');
  },
};
