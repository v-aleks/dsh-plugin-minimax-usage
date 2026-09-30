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
          const [collapsed, setCollapsed] = React.useState(false);

          const toggleCollapsed = React.useCallback(function() {
            setCollapsed(function(prev) { return !prev; });
          }, []);

          const fetchOnce = React.useCallback(async () => {
            try {
              const res = await fetch('/api/minimax/quota', {
                credentials: 'same-origin',
                cache: 'no-store',
              });
              if (!res.ok) {
                let detail = 'HTTP ' + res.status;
                try {
                  const body = await res.json();
                  if (body && body.error) detail = body.error;
                } catch (_) { /* keep HTTP status */ }
                setState({ status: 'error', error: detail });
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

          // Build the rows
          var rows = [];
          if (fh) {
            rows.push(React.createElement(Row, {
              key: 'fh',
              title: '5 小时',
              quota: 100,
              used: typeof fh.used_percent === 'number' ? fh.used_percent : (100 - (fh.remaining_percent ?? 100)),
              remaining: fh.remaining_percent,
              period: fh.period,
              resets_in: typeof fh.resets_in_ms === 'number' ? formatMs(fh.resets_in_ms) : undefined,
              color: (fh.used_percent ?? 0) > 85
                ? 'var(--dsw-alias-state-error, #e85d5d)'
                : 'var(--dsw-alias-brand-primary, #4d86f8)',
            }));
          }
          if (wk) {
            rows.push(React.createElement(Row, {
              key: 'wk',
              title: '本周',
              quota: 100,
              used: typeof wk.used_percent === 'number' ? wk.used_percent : (100 - (wk.remaining_percent ?? 100)),
              remaining: wk.remaining_percent,
              period: wk.period,
              resets_in: typeof wk.resets_in_ms === 'number' ? formatMs(wk.resets_in_ms) : undefined,
              color: (wk.used_percent ?? 0) > 85
                ? 'var(--dsw-alias-state-error, #e85d5d)'
                : 'var(--dsw-alias-state-success, #34d37b)',
            }));
          }

          // Summary line when collapsed: "5h: 42% · 周: 78%"
          var summaryText = '';
          if (fh && wk) {
            summaryText = '5h: ' + (100 - (fh.remaining_percent ?? 0)) + '% · 周: ' + (100 - (wk.remaining_percent ?? 0)) + '%';
          } else if (fh) {
            summaryText = '5h: ' + (100 - (fh.remaining_percent ?? 0)) + '%';
          } else if (wk) {
            summaryText = '周: ' + (100 - (wk.remaining_percent ?? 0)) + '%';
          }

          // Chevron arrow character
          var arrow = collapsed ? '▶' : '▼';

          return React.createElement(
            'div',
            {
              style: {
                width: '100%',
                borderTop: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08))',
              },
            },
            // Header row: clickable to toggle
            React.createElement(
              'div',
              {
                onClick: toggleCollapsed,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px 4px 10px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                },
              },
              React.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement(
                  'span',
                  {
                    style: {
                      fontSize: 8,
                      color: 'var(--dsw-alias-label-tertiary, #888)',
                      transition: 'transform 0.15s ease',
                      display: 'inline-block',
                      transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      width: 10,
                      textAlign: 'center',
                    },
                  },
                  '▶'
                ),
                React.createElement(
                  'span',
                  { style: { fontSize: 10, fontWeight: 600, color: 'var(--dsw-alias-label-secondary, #888)', letterSpacing: 0.5, textTransform: 'uppercase' } },
                  'MiniMax'
                )
              ),
              collapsed && summaryText ? React.createElement(
                'span',
                { style: { fontSize: 10, color: 'var(--dsw-alias-label-tertiary, #888)' } },
                summaryText
              ) : null
            ),
            // Collapsible body
            !collapsed ? React.createElement(
              'div',
              { style: { paddingBottom: 4 } },
              rows
            ) : null
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
