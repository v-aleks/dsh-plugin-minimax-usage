# 📊 MiniMax Quota Monitor

> A [DeepSeek Harness](https://github.com/deepseek-ai/dsh) plugin that displays your MiniMax Coding Plan quota usage directly in the sidebar.

[![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek-Harness%20Plugin-blue?style=flat-square&logo=deepseek)](https://github.com/deepseek-ai/dsh)
[![DSH Client Plugin](https://img.shields.io/badge/dsh--plugin-client-4d86f8?style=flat-square)](https://github.com/deepseek-ai/dsh)
[![npm compatible](https://img.shields.io/badge/npm-compatible-green?style=flat-square&logo=npm)](https://www.npmjs.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](./LICENSE)

**English** · **[中文](./README.zh-CN.md)** · **[日本語](./README.ja.md)** · **[Español](./README.es.md)**

---

## ✨ Features

- **5-Hour Quota Bar** — real-time progress of your current interval remaining
- **Weekly Quota Bar** — weekly allowance usage at a glance
- **Reset Countdown** — shows exactly when each window resets (e.g. `重置于 2h 17m`)
- **Collapsible Panel** — click the arrow to collapse/expand; collapsed state shows a compact summary
- **Auto Refresh** — updates every 60 seconds via server-side cache
- **Sidebar Integration** — renders in `sidebar.footer.action`, right above the Settings button
- **Lightweight** — pure React.createElement, no CSS frameworks, no external images

## 📸 Preview

```
┌──────────────────────────────┐
│  ▼ MINIMAX                   │
│  5 小时   42 / 100 (42%)     │
│  ████████████░░░░░░░░░░░░░░  │
│  重置于 2h 17m                │
│  本周     78 / 100 (78%)     │
│  ████████████████████████░░  │
│  重置于 3d 12h               │
└──────────────────────────────┘
       ↕ click to toggle
┌──────────────────────────────┐
│  ▶ MINIMAX  5h: 42% · 周: 78%│
└──────────────────────────────┘
```

## 🚀 Installation

### Quick Install (recommended)

```bash
cd ~/.dsh/profiles/web
npm link /path/to/this/plugin
# then add the patch entry (see below)
```

### Using pnpm

```bash
cd ~/.dsh/profiles/web
pnpm add /path/to/this/plugin
```

### Via npm registry (when published)

```bash
cd ~/.dsh/profiles/web
pnpm add @dsh-external/minimax-usage
```

### 1. Add to cordis.patch.yml

Append this to `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: minimax-usage
      name: '@dsh-external/minimax-usage'
```

### 2. Set your API key

The plugin reads `MINIMAX_API_KEY` from **one** of these locations, in order:

1. **Environment variable** (recommended):
   ```bash
   # In ~/.zshrc or ~/.bashrc
   export MINIMAX_API_KEY="your-minimax-api-key-here"
   ```
   Then `source ~/.zshrc` (or restart your shell) and restart `dsh web`.
   The `dsh web` process inherits the parent's environment, so this is the
   simplest and safest option.

2. **Local config file** `~/.config/dsh/minimax.json` (use when env vars are
   not available, e.g. CI / sandboxed shells):
   ```bash
   mkdir -p ~/.config/dsh
   printf '%s' '{"apiKey":"your-minimax-api-key-here"}' > ~/.config/dsh/minimax.json
   chmod 600 ~/.config/dsh/minimax.json
   ```

The plugin does **not** parse `~/.zshrc` / `~/.bashrc` / `*.secret` files —
those are shell scripts and unsafe to read with a plain-text regex.

Get your API key from the [MiniMax Open Platform](https://api.minimax.io/).

### 3. Restart & Refresh

```bash
# Restart the DSH web server
dsh web
# Hard-refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)
```

## ⚙️ Configuration

| Source | Description | Default |
|---|---|---|
| `MINIMAX_API_KEY` env | Your MiniMax API key | *(required)* |
| `~/.config/dsh/minimax.json` | Local config `{"apiKey":"..."}` (chmod 600) | *(optional)* |

The plugin reads the key at request time. If the key is not available, the plugin will display an error message in the sidebar instead of crashing.

The MiniMax endpoint is:

```
GET https://api.minimax.io/v1/api/openplatform/coding_plan/remains
Authorization: Bearer <MINIMAX_API_KEY>
Content-Type: application/json
```

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│  Host (Node.js)                 │
│  lib/index.js                   │
│  ├─ registers /api/minimax/quota│
│  ├─ reads MINIMAX_API_KEY       │
│  ├─ calls MiniMax REST API      │
│  └─ 60s server-side cache       │
└──────────┬──────────────────────┘
           │ fetch('/api/minimax/quota')
           ▼
┌─────────────────────────────────┐
│  Client (Browser)               │
│  lib/client.js                  │
│  ├─ Slot: sidebar.footer.action │
│  ├─ Collapsible QuotaCard       │
│  └─ 60s auto-refresh            │
└─────────────────────────────────┘
```

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Notes

- The MiniMax API's `remains_time` / `weekly_remains_time` fields are unreliable (may return ~96 days for a 5h window). This plugin derives reset countdowns from `end_time - Date.now()` instead, which is accurate.
- The `end_time`, `start_time`, `weekly_end_time`, and `weekly_start_time` fields are unix-millisecond timestamps despite the field names.
- Quota percentages are reported by the API as 0–100 integers.

## 📋 DSH Plugin Manifest

This plugin is designed for **DeepSeek Harness** and follows the DSH npm-package plugin format:

- **`dsh.bundle.patch`** — Cordis patch file for automatic registration
- **`dsh.client.inject`** — No external service dependencies
- **`dsh.client.platform`** — `web` (browser-only client)
- **Slot** — `sidebar.footer.action`

### Tags / Keywords

`deepseek-harness` · `dsh` · `dsh-plugin` · `dsh-client-plugin` · `minimax` · `quota` · `usage-monitor` · `sidebar` · `coding-plan`

## 📜 License

[MIT](./LICENSE) © 2026 ovensi

---

<p align="center">
  Built for <a href="https://github.com/deepseek-ai/dsh">DeepSeek Harness</a> 🚀
</p>
