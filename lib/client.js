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
    const NUM_FORMAT = new Intl.NumberFormat();

    function clamp(n) {
      if (typeof n !== 'number' || !isFinite(n)) return 0;
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    }

    function formatMs(ms) {
      // Format a millisecond duration as "Nd Nh Nm" or "Nh Nm" or "Nm".
      // Host sends negative / zero when the window has already reset.
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
          const [state, setState] = React.useState({ status: 'loading' });

          const fetchOnce = React.useCallback(async () => {
            try {
              const res = await fetch('/api/minimax/quota', {
                credentials: 'same-origin',
                cache: 'no-store',
              });
              if (!res.ok) {
                setState({ status: 'error', error: 'HTTP ' + res.status });
                return;
              }
              const data = await res.json();
              if (data && data.error) {
                setState({ status: 'error', error: data.error });
                return;
              }
              setState(Object.assign({ status: 'ok' }, data || {}));
            } catch (e) {
              setState({ status: 'error', error: String(e && e.message || e) });
            }
          }, []);

          React.useEffect(() => {
            fetchOnce();
            const timer = ctx.get('timer');
            const dispose = timer ? timer.interval(fetchOnce, REFRESH_MS) : null;
            return () => { if (dispose) dispose(); };
          }, [fetchOnce]);

          if (!wide) return null;

          if (state.status === 'loading') {
            return React.createElement(
              'div',
              { style: { padding: '8px 10px', fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #888)', width: '100%' } },
              'MiniMax · 加载中…'
            );
          }

          if (state.status === 'error' || state.error) {
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