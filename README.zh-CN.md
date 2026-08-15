# 📊 MiniMax 额度监控

> 一款 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 插件，在侧边栏实时展示 MiniMax 编程计划的额度使用情况。

[![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek-Harness%20Plugin-blue?style=flat-square&logo=deepseek)](https://github.com/deepseek-ai/dsh)
[![DSH Client Plugin](https://img.shields.io/badge/dsh--plugin-client-4d86f8?style=flat-square)](https://github.com/deepseek-ai/dsh)
[![npm compatible](https://img.shields.io/badge/npm-compatible-green?style=flat-square&logo=npm)](https://www.npmjs.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](./LICENSE)

**[English](./README.md)** · **中文** · **[日本語](./README.ja.md)** · **[Español](./README.es.md)**

---

## ✨ 功能特性

- **5 小时额度条** — 实时显示当前计费周期的剩余额度
- **每周额度条** — 一目了然查看每周配额使用情况
- **重置倒计时** — 精确显示额度窗口重置时间（如 `重置于 2h 17m`）
- **自动刷新** — 每 60 秒通过服务端缓存自动更新
- **侧边栏集成** — 渲染在 `sidebar.footer.action` 位置，紧邻「设置」按钮上方
- **轻量实现** — 纯 React.createElement，无 CSS 框架，无外部图片

## 📸 预览

```
┌──────────────────────────────┐
│  MINIMAX                     │
│  5 小时   42 / 100 (42%)     │
│  ████████████░░░░░░░░░░░░░░  │
│  重置于 2h 17m                │
│                              │
│  本周     78 / 100 (78%)     │
│  ████████████████████████░░  │
│  重置于 3d 12h               │
└──────────────────────────────┘
```

## 🚀 安装

### 快速安装（推荐）

```bash
cd ~/.dsh/profiles/web
npm link /path/to/this/plugin
# 然后添加 patch 条目（见下文）
```

### 使用 pnpm

```bash
cd ~/.dsh/profiles/web
pnpm add /path/to/this/plugin
```

### 通过 npm 注册表安装（发布后可用）

```bash
cd ~/.dsh/profiles/web
pnpm add @dsh-external/minimax-usage
```

### 1. 添加到 cordis.patch.yml

在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加：

```yaml
- insert:
    - id: minimax-usage
      name: '@dsh-external/minimax-usage'
```

### 2. 设置 API 密钥

插件会从 `~/.zshrc.secret`（或你的 shell 密钥文件）读取 `MINIMAX_API_KEY`：

```bash
# 在 ~/.zshrc.secret 或 ~/.bashrc.secret 中
export MINIMAX_API_KEY="你的-minimax-api-密钥"
```

在 [MiniMax 开放平台](https://www.minimaxi.com/) 获取你的 API 密钥。

### 3. 重启并刷新

```bash
# 重启 DSH Web 服务器
dsh web
# 硬刷新浏览器（Cmd+Shift+R / Ctrl+Shift+R）
```

## ⚙️ 配置

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `MINIMAX_API_KEY` | 你的 MiniMax API 密钥 | *（必填）* |

API 密钥在每次请求时通过 `source ~/.zshrc.secret` 动态加载。如果密钥未设置，插件会在侧边栏显示错误信息，而不会崩溃。

## 🏗️ 架构

```
┌─────────────────────────────────┐
│  宿主端 (Node.js)               │
│  lib/index.js                   │
│  ├─ 注册 /api/minimax/quota    │
│  ├─ 读取 MINIMAX_API_KEY        │
│  ├─ 调用 MiniMax REST API       │
│  └─ 60 秒服务端缓存             │
└──────────┬──────────────────────┘
           │ fetch('/api/minimax/quota')
           ▼
┌─────────────────────────────────┐
│  客户端 (浏览器)                 │
│  lib/client.js                  │
│  ├─ 插槽: sidebar.footer.action │
│  ├─ QuotaCard React 组件        │
│  └─ 60 秒自动刷新               │
└─────────────────────────────────┘
```

## 🤝 贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 发起 Pull Request

## 📝 技术说明

- MiniMax API 返回的 `remains_time` / `weekly_remains_time` 字段不可靠（可能在 5 小时窗口返回 ~96 天）。本插件通过 `end_time - Date.now()` 计算重置倒计时，结果更准确。
- `end_time`、`start_time`、`weekly_end_time`、`weekly_start_time` 虽然字段名看似秒级时间戳，实际为 **毫秒级 Unix 时间戳**。
- 额度百分比由 API 以 0–100 的整数返回。

## 📋 DSH 插件清单

本插件专为 **DeepSeek Harness** 设计，遵循 DSH npm-package 插件格式：

- **`dsh.bundle.patch`** — Cordis 补丁文件，用于自动注册
- **`dsh.client.inject`** — 无外部服务依赖
- **`dsh.client.platform`** — `web`（仅浏览器端客户端）
- **插槽** — `sidebar.footer.action`

### 标签 / 关键词

`deepseek-harness` · `dsh` · `dsh-plugin` · `dsh-client-plugin` · `minimax` · `quota` · `usage-monitor` · `sidebar` · `coding-plan`

## 📜 许可证

[MIT](./LICENSE) © 2026 ovensi

---

<p align="center">
  专为 <a href="https://github.com/deepseek-ai/dsh">DeepSeek Harness</a> 构建 🚀
</p>
