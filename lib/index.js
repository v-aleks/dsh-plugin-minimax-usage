// Host bundle: registers /api/minimax/quota HTTP route.
// Sources MINIMAX_API_KEY via process.env, ~/.zshrc.secret, or shell.exec,
// then calls
//   GET https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains
// Returns { fiveHour, weekly } with remaining percentages and reset countdowns.

const CACHE_TTL_MS = 60 * 1000;
const ENDPOINT = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';
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

// Best-effort, dependency-light key resolution. Tries (in order):
//   1. process.env.MINIMAX_API_KEY
//   2. plain-file parse of ~/.zshrc.secret (no shell `source`)
//   3. shell service (only if it exposes a usable API)
// Each step is wrapped so a failure is non-fatal and we fall through.
function readKeyFromEnvFile() {
  const candidates = [
    path.join(os.homedir(), '.zshrc.secret'),
    path.join(os.homedir(), '.zshrc'),
    path.join(os.homedir(), '.bashrc.secret'),
    path.join(os.homedir(), '.bashrc'),
  ];
  const re = /^\s*(?:export\s+)?MINIMAX_API_KEY\s*=\s*["']?([^"'\n#]+)["']?/m;
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(re);
      if (m && m[1]) return m[1].trim();
    } catch (_) { /* file may not exist or be unreadable; try next */ }
  }
  return '';
}

async function readKeyViaShell(shell) {
  if (!shell) return '';
  // Newer DSH shell services expose shell.exec(command, options).
  if (typeof shell.exec === 'function') {
    try {
      const result = await shell.exec(
        'source ~/.zshrc.secret 2>/dev/null; printf "%s" "${MINIMAX_API_KEY:-}"',
        { timeout: 3000 }
      );
      const text = (result && typeof result === 'object' && typeof result.stdout === 'string')
        ? result.stdout : (typeof result === 'string' ? result : '');
      return text.trim();
    } catch (_) { /* fall through */ }
  }
  // Older DSH shell: spec.resolve(...).run(...).
  if (typeof shell.resolve === 'function' && typeof shell.run === 'function') {
    try {
      const spec = shell.resolve({
        command: 'source ~/.zshrc.secret 2>/dev/null; printf "%s" "${MINIMAX_API_KEY:-}"',
        timeoutMs: 3000,
      });
      const result = await shell.run(spec);
      const text = (result && result.stdout && typeof result.stdout.text === 'string')
        ? result.stdout.text : '';
      return text.trim();
    } catch (_) { /* fall through */ }
  }
  return '';
}

async function readApiKey(shell) {
  // 1. process.env
  if (process.env.MINIMAX_API_KEY && process.env.MINIMAX_API_KEY.trim()) {
    return process.env.MINIMAX_API_KEY.trim();
  }
  // 2. plain-file parse
  const fromFile = readKeyFromEnvFile();
  if (fromFile) return fromFile;
  // 3. shell service as last resort
  const fromShell = await readKeyViaShell(shell);
  if (fromShell) return fromShell;
  return '';
}

async function fetchQuota(shell) {
  let apiKey;
  try {
    apiKey = await readApiKey(shell);
  } catch (e) {
    return { error: 'shell error: ' + String(e && e.message || e) };
  }
  if (!apiKey) return { error: 'MINIMAX_API_KEY not set (env, ~/.zshrc.secret, or shell)' };

  const safeKey = apiKey.replace(/'/g, "'\\''");

  // Primary path: shell.exec(/usr/bin/curl).
  let stdout = '';
  let usedShell = false;
  if (shell && typeof shell.exec === 'function') {
    try {
      const result = await shell.exec(
        `/usr/bin/curl -sS -m 10 -H 'Authorization: Bearer ${safeKey}' ` +
        `-H 'Content-Type: application/json' '${ENDPOINT}'`,
        { timeout: 12000 }
      );
      usedShell = true;
      if (typeof result === 'string') stdout = result;
      else if (result && typeof result.stdout === 'string') stdout = result.stdout;
      if (result && typeof result.exitCode === 'number' && result.exitCode !== 0) {
        const stderrText = (result.stderr && typeof result.stderr === 'string') ? result.stderr : '';
        return { error: 'curl failed (exit ' + result.exitCode + '): ' + (stderrText || 'no result') };
      }
    } catch (e) {
      return { error: 'curl exec error: ' + String(e && e.message || e) };
    }
  } else if (shell && typeof shell.resolve === 'function' && typeof shell.run === 'function') {
    try {
      const curlSpec = shell.resolve({
        command: '/usr/bin/curl -sS -m 10 -H \'Authorization: Bearer ' + safeKey +
                 '\' -H \'Content-Type: application/json\' \'' + ENDPOINT + '\'',
        timeoutMs: 12000,
      });
      const curlResult = await shell.run(curlSpec);
      usedShell = true;
      const exitCode = curlResult ? curlResult.exitCode : null;
      if (!curlResult || exitCode !== 0) {
        const stderrText = (curlResult && curlResult.stderr && typeof curlResult.stderr.text === 'string')
          ? curlResult.stderr.text : '';
        return { error: 'curl failed (exit ' + exitCode + '): ' + (stderrText || 'no result') };
      }
      stdout = (curlResult.stdout && typeof curlResult.stdout.text === 'string')
        ? curlResult.stdout.text : '';
    } catch (e) {
      return { error: 'curl exec error: ' + String(e && e.message || e) };
    }
  }

  // Fallback path: Node https module. Used when shell service is absent
  // or refused to exec `/usr/bin/curl`.
  if (!usedShell) {
    try {
      stdout = await nodeFetchQuota(safeKey);
    } catch (e) {
      return { error: 'https fetch error: ' + String(e && e.message || e) };
    }
  }

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

module.exports = {
  inject: ['shell', 'webServer'],
  apply(ctx) {
    const webServer = ctx.webServer;
    if (!webServer) {
      console.error('[minimax-usage] webServer service unavailable; route not registered');
      return;
    }
    const shell = ctx.shell || null;
    if (!shell) {
      console.warn('[minimax-usage] shell service unavailable; route will use Node https fallback');
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
          const data = await fetchQuota(shell);
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
