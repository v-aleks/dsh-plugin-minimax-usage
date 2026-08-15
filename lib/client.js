window.__ModuleLoader__.load({
  id: "@dsh-external/minimax-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    if (React && React.default && !React.createElement) {
      React = React.default;
    }

    const REFRESH_MS = 60 * 1000;
    const MODEL_CHECK_MS = 3 * 1000;
    const NUM_FORMAT = new Intl.NumberFormat();

    function clamp(n) {
      if (typeof n !== 'number' || !isFinite(n)) return 0;
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    }

    function formatMs(ms) {
      if (typeof ms !== 'number' || !isFinite(ms)) return undefined;
      const remaining = Math.max(0, Math.floor(ms / 1000));
      const d = Math.floor(remaining / 86400);
      const h = Math.floor((remaining % 86400) / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const parts = [];
      if (d) parts.push(d + 'd');
      if (h) parts.push(h + 'h');
      if (m || parts.length === 0) parts.push(m + 'm');
      return parts.join(' ');
    }

    function ratio(used, quota) {
      if (typeof used !== 'number' || typeof quota !== 'number' || quota <= 0) return 0;
      return clamp(used / quota);
    }

    function Row(props) {
      const { title, quota, used, remaining, period, resets_in, color } = props;
      const pct = ratio(used, quota);
      const pctLabel = (pct * 100).toFixed(pct >= 0.1 || pct === 0 ? 0 : 1);
      const usedText = (typeof used === 'number' ? NUM_FORMAT.format(used) : '?') +
                       ' / ' +
                       (typeof quota === 'number' ? NUM_FORMAT.format(quota) : '?');
      return React.createElement(
        'div',
        { style: { padding: '4px 8px 6px 8px' } },
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: 11,
              color: 'var(--dsw-alias-label-secondary, #888)',
              marginBottom: 2,
            },
          },
          React.createElement('span', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary, #ddd)' } }, title),
          React.createElement('span', null, usedText + ' (' + pctLabel + '%)')
        ),
        React.createElement(
          'div',
          {
            style: {
              height: 4,
              borderRadius: 2,
              background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.08))',
              overflow: 'hidden',
            },
          },
          React.createElement('div', {
            style: {
              width: (pct * 100).toFixed(2) + '%',
              height: '100%',
              background: color,
              transition: 'width 0.4s ease',
            },
          })
        ),
        React.createElement(
          'div',
          {
            style: {
              fontSize: 10,
              color: 'var(--dsw-alias-label-tertiary, #777)',
              marginTop: 2,
            },
          },
          resets_in ? '重置于 ' + resets_in : (period || '')
        )
      );
    }

    return {
      apply(ctx) {
        const slots = ctx.get('slots');
        if (!slots) return;

        function QuotaCard(ownerProps) {
          const wide = !!(ownerProps && ownerProps.wide);
          // Three-phase: 'model-check' → if minimax → 'loading' → 'ok'|'error'; if not minimax → 'hidden'
          const [state, setState] = React.useState({ phase: 'model-check' });

          // Phase 1: check if current model is MiniMax
          React.useEffect(() => {
            let cancelled = false;
            let pollTimer = null;

            async function checkModel() {
              try {
                const res = await fetch('/api/minimax/model-check', {
                  credentials: 'same-origin',
                  cache: 'no-store',
                });
                if (!res.ok) {
                  if (!cancelled) setState({ phase: 'hidden' });
                  return;
                }
                const data = await res.json();
                if (cancelled) return;
                if (data && data.isMiniMax) {
                  // Current model is MiniMax — proceed to fetch quota
                  setState({ phase: 'loading' });
                } else {
                  setState({ phase: 'hidden' });
                  // Keep polling in case user switches model later
                  if (!pollTimer) {
                    const timer = ctx.get('timer');
                    if (timer) {
                      pollTimer = timer.interval(async () => {
                        try {
                          const r = await fetch('/api/minimax/model-check', {
                            credentials: 'same-origin',
                            cache: 'no-store',
                          });
                          if (!r.ok) return;
                          const d = await r.json();
                          if (d && d.isMiniMax && !cancelled) {
                            // Model switched to MiniMax — clear poll, start loading quota
                            if (pollTimer) { pollTimer(); pollTimer = null; }
                            setState({ phase: 'loading' });
                          }
                        } catch (_) {}
                      }, MODEL_CHECK_MS);
                    }
                  }
                }
              } catch (_) {
                if (!cancelled) setState({ phase: 'hidden' });
              }
            }

            checkModel();
            return () => { cancelled = true; if (pollTimer) { pollTimer(); pollTimer = null; } };
          }, []);

          // Phase 2: fetch quota data once model confirmed as MiniMax
          const fetchQuota = React.useCallback(async () => {
            try {
              const res = await fetch('/api/minimax/quota', {
                credentials: 'same-origin',
                cache: 'no-store',
              });
              if (!res.ok) {
                setState(function(prev) { return Object.assign({}, prev, { phase: 'error', error: 'HTTP ' + res.status }); });
                return;
              }
              const data = await res.json();
              if (data && data.error) {
                setState(function(prev) { return Object.assign({}, prev, { phase: 'error', error: data.error }); });
                return;
              }
              setState(Object.assign({ phase: 'ok' }, data || {}));
            } catch (e) {
              setState(function(prev) { return Object.assign({}, prev, { phase: 'error', error: String(e && e.message || e) }); });
            }
          }, []);

          React.useEffect(() => {
            if (state.phase !== 'loading') return;
            fetchQuota();
            const timer = ctx.get('timer');
            const dispose = timer ? timer.interval(fetchQuota, REFRESH_MS) : null;
            return () => { if (dispose) dispose(); };
          }, [state.phase, fetchQuota]);

          // Also re-check model periodically while showing quota (in case user switches away)
          React.useEffect(() => {
            if (state.phase === 'hidden' || state.phase === 'model-check') return;
            const timer = ctx.get('timer');
            if (!timer) return;
            const dispose = timer.interval(async () => {
              try {
                const r = await fetch('/api/minimax/model-check', {
                  credentials: 'same-origin',
                  cache: 'no-store',
                });
                if (!r.ok) return;
                const d = await r.json();
                if (d && !d.isMiniMax) {
                  setState({ phase: 'hidden' });
                }
              } catch (_) {}
            }, MODEL_CHECK_MS);
            return function() { dispose(); };
          }, [state.phase]);

          // Hidden state: not a MiniMax model, render nothing
          if (state.phase === 'hidden' || state.phase === 'model-check') return null;

          if (!wide) return null;

          if (state.phase === 'loading') {
            return React.createElement(
              'div',
              { style: { padding: '8px 10px', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', width: '100%' } },
              'MiniMax · 加载中…'
            );
          }

          if (state.phase === 'error' || state.error) {
            return React.createElement(
              'div',
              {
                style: {
                  padding: '6px 10px',
                  fontSize: 11,
                  color: 'var(--dsw-alias-state-error, #e85d5d)',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
                title: state.error || 'unknown',
              },
              '⚠ MiniMax · ' + (state.error || '错误')
            );
          }

          const fh = state.fiveHour;
          const wk = state.weekly;

          if (!fh && !wk) {
            return React.createElement(
              'div',
              { style: { padding: '6px 10px', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)' } },
              'MiniMax · 暂无数据'
            );
          }

          return React.createElement(
            'div',
            {
              style: {
                width: '100%',
                padding: '6px 4px 8px 4px',
                borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08))',
              },
            },
            React.createElement(
              'div',
              { style: { fontSize: 10, fontWeight: 600, color: 'var(--dsw-alias-label-secondary, #888)', padding: '0 8px 4px 8px', letterSpacing: 0.5, textTransform: 'uppercase' } },
              'MiniMax'
            ),
            fh && React.createElement(Row, {
              title: '5 小时',
              quota: 100,
              used: typeof fh.used_percent === 'number' ? fh.used_percent : (100 - (fh.remaining_percent ?? 100)),
              remaining: fh.remaining_percent,
              period: fh.period,
              resets_in: typeof fh.resets_in_ms === 'number' ? formatMs(fh.resets_in_ms) : undefined,
              color: (fh.used_percent ?? 0) > 85
                ? 'var(--dsw-alias-state-error, #e85d5d)'
                : 'var(--dsw-alias-brand-primary, #4d86f8)',
            }),
            wk && React.createElement(Row, {
              title: '本周',
              quota: 100,
              used: typeof wk.used_percent === 'number' ? wk.used_percent : (100 - (wk.remaining_percent ?? 100)),
              remaining: wk.remaining_percent,
              period: wk.period,
              resets_in: typeof wk.resets_in_ms === 'number' ? formatMs(wk.resets_in_ms) : undefined,
              color: (wk.used_percent ?? 0) > 85
                ? 'var(--dsw-alias-state-error, #e85d5d)'
                : 'var(--dsw-alias-state-success, #34d37b)',
            })
          );
        }

        slots.inject('sidebar.footer.action', () => slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'minimax-quota',
            order: -10,
            label: () => 'MiniMax',
          },
          (ownerProps) => React.createElement(QuotaCard, ownerProps)
        ));
      },
    };
  },
});
