# 📊 MiniMax クォータモニター

> [DeepSeek Harness](https://github.com/deepseek-ai/dsh) 向けプラグイン。MiniMax コーディングプランのクォータ使用状況をサイドバーにリアルタイム表示します。

[![DeepSeek Harness Plugin](https://img.shields.io/badge/DeepSeek-Harness%20Plugin-blue?style=flat-square&logo=deepseek)](https://github.com/deepseek-ai/dsh)
[![DSH Client Plugin](https://img.shields.io/badge/dsh--plugin-client-4d86f8?style=flat-square)](https://github.com/deepseek-ai/dsh)
[![npm compatible](https://img.shields.io/badge/npm-compatible-green?style=flat-square&logo=npm)](https://www.npmjs.com/)
[![MIT License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)](./LICENSE)

**[English](./README.md)** · **[中文](./README.zh-CN.md)** · **日本語** · **[Español](./README.es.md)**

---

## ✨ 機能

- **5時間クォータバー** — 現在の課金間隔の残りクォータをリアルタイム表示
- **週次クォータバー** — 週間割り当ての使用状況を一目で確認
- **リセットカウントダウン** — 各ウィンドウのリセット時間を正確に表示（例: `重置于 2h 17m`）
- **自動更新** — サーバーサイドキャッシュにより60秒ごとに自動更新
- **サイドバー統合** — `sidebar.footer.action` スロットにレンダリング、設定ボタンのすぐ上
- **軽量実装** — React.createElement のみ、CSSフレームワーク不要、外部画像なし

## 📸 プレビュー

```
┌──────────────────────────────┐
│  MINIMAX                     │
│  5 小時   42 / 100 (42%)     │
│  ████████████░░░░░░░░░░░░░░  │
│  重置于 2h 17m                │
│                              │
│  本周     78 / 100 (78%)     │
│  ████████████████████████░░  │
│  重置于 3d 12h               │
└──────────────────────────────┘
```

## 🚀 インストール

### クイックインストール（推奨）

```bash
cd ~/.dsh/profiles/web
npm link /path/to/this/plugin
# パッチエントリを追加（下記参照）
```

### pnpm を使用

```bash
cd ~/.dsh/profiles/web
pnpm add /path/to/this/plugin
```

### npm レジストリ経由（公開後）

```bash
cd ~/.dsh/profiles/web
pnpm add @dsh-external/minimax-usage
```

### 1. cordis.patch.yml に追加

`~/.dsh/profiles/web/cordis.patch.yml` の末尾に追記:

```yaml
- insert:
    - id: minimax-usage
      name: '@dsh-external/minimax-usage'
```

### 2. APIキーの設定

プラグインは `~/.zshrc.secret`（またはシェルのシークレットファイル）から `MINIMAX_API_KEY` を読み取ります:

```bash
# ~/.zshrc.secret または ~/.bashrc.secret に記述
export MINIMAX_API_KEY="your-minimax-api-key-here"
```

[MiniMax オープンプラットフォーム](https://www.minimaxi.com/) でAPIキーを取得してください。

### 3. 再起動とリフレッシュ

```bash
# DSH Webサーバーを再起動
dsh web
# ブラウザをハードリフレッシュ（Cmd+Shift+R / Ctrl+Shift+R）
```

## ⚙️ 設定

| 環境変数 | 説明 | デフォルト |
|---|---|---|
| `MINIMAX_API_KEY` | MiniMax APIキー | *（必須）* |

APIキーはリクエスト時に `source ~/.zshrc.secret` で動的に読み込まれます。キーが未設定の場合、プラグインはクラッシュせずにサイドバーにエラーメッセージを表示します。

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────┐
│  ホスト (Node.js)               │
│  lib/index.js                   │
│  ├─ /api/minimax/quota を登録   │
│  ├─ MINIMAX_API_KEY を読み取り   │
│  ├─ MiniMax REST API を呼び出し  │
│  └─ 60秒サーバーサイドキャッシュ  │
└──────────┬──────────────────────┘
           │ fetch('/api/minimax/quota')
           ▼
┌─────────────────────────────────┐
│  クライアント (ブラウザ)         │
│  lib/client.js                  │
│  ├─ スロット: sidebar.footer.action │
│  ├─ QuotaCard Reactコンポーネント│
│  └─ 60秒自動更新                │
└─────────────────────────────────┘
```

## 🤝 コントリビュート

1. このリポジトリをFork
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Request を作成

## 📝 技術メモ

- MiniMax APIの `remains_time` / `weekly_remains_time` フィールドは信頼性が低い（5時間ウィンドウに対して約96日を返す場合がある）。本プラグインは `end_time - Date.now()` からリセットカウントダウンを算出しており、正確です。
- `end_time`、`start_time`、`weekly_end_time`、`weekly_start_time` はフィールド名に関わらず **ミリ秒Unixタイムスタンプ** です。
- クォータパーセンテージはAPIが0〜100の整数で返します。

## 📋 DSH プラグインマニフェスト

本プラグインは **DeepSeek Harness** 向けに設計され、DSH npm-package プラグイン形式に準拠しています:

- **`dsh.bundle.patch`** — 自動登録用Cordisパッチファイル
- **`dsh.client.inject`** — 外部サービス依存なし
- **`dsh.client.platform`** — `web`（ブラウザのみのクライアント）
- **スロット** — `sidebar.footer.action`

### タグ / キーワード

`deepseek-harness` · `dsh` · `dsh-plugin` · `dsh-client-plugin` · `minimax` · `quota` · `usage-monitor` · `sidebar` · `coding-plan`

## 📜 ライセンス

[MIT](./LICENSE) © 2026 ovensi

---

<p align="center">
  <a href="https://github.com/deepseek-ai/dsh">DeepSeek Harness</a> 向けに構築 🚀
</p>
