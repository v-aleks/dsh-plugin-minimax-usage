// Host bundle: registers /api/minimax/quota HTTP route.
// Sources MINIMAX_API_KEY via process.env, ctx.config.minimax.apiKey, or
// ~/.config/dsh/minimax.json, then calls
//   GET https://api.minimax.io/v1/api/openplatform/coding_plan/remains
// Returns { fiveHour, weekly } with remaining percentages and reset countdowns.

const CACHE_TTL_MS = 60 * 1000;
const ENDPOINT = 'https://api.minimax.io/v1/api/openplatform/coding_plan/remains';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

// Resolve MINIMAX_API_KEY without touching the shell service. The shell
// service in this DSH profile does not expose shell.run / shell.resolve,
// so we read the key from safe, non-shell sources only.
function readApiKey(ctx) {
  // 1. process.env — preferred. DSH-web inherits the parent's environment,
  //    so `export MINIMAX_API_KEY=...` in ~/.zshrc works after `dsh web`.
  if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY.trim()) {
    return process.env.MINIMAX_API_KEY.trim();
  }

  // 2. cordis config — only used when the user explicitly wires it up via
  //    `cordis.patch.yml` with `config: { minimax: { apiKey: ... } }`.
  //    Note: do not commit such a patch file to a public repo.
  try {
    const cfg = ctx && ctx.config && ctx.config.minimax;
    if (cfg && typeof cfg.apiKey === 'string' && cfg.apiKey.trim()) {
      return cfg.apiKey.trim();
    }
  } catch (_) { /* ctx.config may be undefined */ }

  // 3. Local JSON file at a stable, per-tool path. The user is expected to
  //    `chmod 600` it. We deliberately do NOT parse shell rc files — those
  //    can contain comments, multi-line exports, or arbitrary code that a
  //    naive regex would either miss or leak into an error message.
  const cfgPath = path.join(os.homedir(), '.config', 'dsh', 'minimax.json');
  try {
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj.apiKey === 'string' && obj.apiKey.trim()) {
      return obj.apiKey.trim();
    }
  } catch (_) { /* file missing or unreadable — fall through */ }

  return '';
}

// Pure-Node HTTPS GET. Used as the only HTTP path — we deliberately do NOT
// route through ctx.shell because in this DSH profile shell.run is not a
// function. Keeping the request path independent of ctx.shell also means a
// future shell API change cannot break quota reporting.
function nodeFetchQuota(apiKey) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(ENDPOINT); }
    catch (e) { return reject(new Error('bad ENDPOINT url: ' + ENDPOINT)); }

    const lib = url.protocol === 'http:' ? require('node:http') : require('node:https');
    const req = lib.request({
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'dsh-plugin-minimax-usage/0.1.0',
      },
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 200)));
        }
        resolve(body);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('request timeout')); });
    req.end();
  });
}

async function fetchQuota(ctx) {
  const apiKey = readApiKey(ctx);
  if (!apiKey) return { error: 'MINIMAX_API_KEY not set (env, ctx.config.minimax.apiKey, or ~/.config/dsh/minimax.json)' };

  let stdout;
  try {
    stdout = await nodeFetchQuota(apiKey);
  } catch (e) {
    // Avoid leaking the raw exception text: Node network errors sometimes
    // surface hostnames or partial request URLs that are not sensitive but
    // we keep messages short and code-only.
    const code = (e && e.code) ? String(e.code) : 'network_error';
    return { error: 'https fetch error: ' + code };
  }

  let parsed = null;
  try { parsed = JSON.parse(stdout); }
  catch (e) {
    return { error: 'invalid JSON from API' };
  }

  if (parsed.base_resp && parsed.base_resp.status_code !== 0) {
    return { error: 'API: ' + (parsed.base_resp.status_msg || 'error code ' + parsed.base_resp.status_code) };
  }

  const row = pickFirstModel(parsed);
  if (!row) return { error: 'no model_remains rows in response' };

  return mapRow(row);
}

module.exports = {
  // Note: we still depend on webServer for route registration, but we no
  // longer inject `shell` because the only HTTP and key-reading paths are
  // implemented with Node built-ins and never touch ctx.shell.
  inject: ['webServer'],
  apply(ctx) {
    const webServer = ctx.webServer;
    if (!webServer) {
      console.error('[minimax-usage] webServer service unavailable; route not registered');
      return;
    }

    // Wrap webServer.register in ctx.effect so the route registration is
    // bound to this plugin fiber's lifecycle. On HMR (root.update via
    // cordis.patch.yml) the old fiber is disposed first — cancelling the
    // previous registration — before the recompose installs a fresh route.
    // Without ctx.effect, the second registration throws a duplicate-route
    // error from webServer.
    ctx.effect(() => webServer.register({
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
          const data = await fetchQuota(ctx);
          if (!data || !data.error) {
            cache = { at: now, data };
          }
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(data || { error: 'empty response' }));
        } catch (e) {
          // Last-resort safety net: surface the actual exception message
          // in the JSON body with status 200 so the client can render it.
          console.error('[minimax-usage] /api/minimax/quota handler threw:', e && e.stack || e);
          const msg = String(e && e.message || e);
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify({ error: 'handler crashed: ' + msg }));
        }
      },
    }));

    console.log('[minimax-usage] /api/minimax/quota route registered');
  },
};
