# GLM-5 Teammate セットアップ（非公式）

> **WARNING**: この方法は非公式です
> - `CLAUDE_CODE_TEAMMATE_COMMAND` は Anthropic 公式ドキュメントに記載されていない非公式の環境変数です（2026-02 時点）
> - Claude Code のアップデートで予告なく動作しなくなる可能性があります
> - Anthropic のサポート対象外です
> - Z.AI API の利用は Z.AI (智谱AI) の利用規約に従います

## 概要

Agent Teams で Teammate を起動する際、環境変数 `CLAUDE_CODE_TEAMMATE_COMMAND` に glm ラッパーのパスを指定すると、Teammate プロセスだけが Z.AI API 経由で GLM-5 を使用します。リーダー（Opus）は通常の Anthropic API を使い続けるため、**リーダーは高品質な判断、Teammate は低コストな実行**というハイブリッド構成が可能です。

## セットアップ

```bash
# Z.AI の API キーを用意して実行（対話的にキーを入力）
bash scripts/setup-glm-teammate.sh
```

スクリプトが生成するもの:

| 生成物 | パス | 用途 |
|--------|------|------|
| glm ラッパー | `/usr/local/bin/glm` | GLM-5 で Claude Code を起動。API キー埋め込み + model intercept |
| glm-setup | `/usr/local/bin/glm-setup` | API キー変更後の再生成ヘルパー |
| MCP 設定 | `~/.claude/glm-mcp.json` | Z.AI MCP サーバー（Web検索・Webリーダー・Vision） |
| 環境変数 | `~/.bashrc` | `ZAI_API_KEY` + `CLAUDE_CODE_TEAMMATE_COMMAND` |
| settings | `~/.claude/settings.json` | `env.CLAUDE_CODE_TEAMMATE_COMMAND` |

## 仕組み

glm ラッパーは以下の 3 段階で動作します:

1. **環境変数の設定** — `ANTHROPIC_BASE_URL` を Z.AI エンドポイントに、`ANTHROPIC_AUTH_TOKEN` を API キーに設定。`ANTHROPIC_DEFAULT_*_MODEL` で全モデルエイリアスを GLM-5 にマッピング
2. **--model intercept** — Agent Teams は Teammate に `--model claude-opus-4-6` のようなリテラルモデル名を渡します。リテラル名は `ANTHROPIC_DEFAULT_*_MODEL` のエイリアスマッピングをバイパスするため、glm ラッパーが引数を書き換えてエイリアス（`opus`/`sonnet`/`haiku`）に変換します
3. **exec claude** — `--mcp-config` で Z.AI MCP サーバーを有効化し、Claude Code を起動

## 既知の問題と対策

| 問題 | 原因 | 対策 |
|------|------|------|
| settings.json だけでは Teammate に伝播しない | `env` ブロックが許可リスト外で `process.env` に入らない場合がある | `.bashrc` にも `CLAUDE_CODE_TEAMMATE_COMMAND` を export（ベルト＆サスペンダー方式） |
| OAuth が優先され Anthropic API に接続 | `--model claude-opus-4-6` のリテラル名で OAuth フローが起動 | glm ラッパーの `--model` intercept でエイリアスに変換 |
| API キー変更後に Teammate が認証失敗 | glm ラッパーにキーが埋め込まれている | `glm-setup` でラッパーと MCP 設定を再生成 |

## 検証方法

```bash
# Teammate プロセスの環境変数を確認（PID は実際の値に置換）
cat /proc/<PID>/environ | tr '\0' '\n' | grep ANTHROPIC

# ネットワーク接続先が api.z.ai であることを確認
ss -tnp | grep <PID>

# api.anthropic.com への推論接続がないことを確認
# (api.z.ai: 128.14.69.x、api.anthropic.com: 160.79.104.x)
```

## API キー変更時

```bash
# 1. 新しいキーを環境変数に設定
export ZAI_API_KEY="new-key-here"

# 2. glm-setup で glm ラッパーと MCP 設定を再生成
glm-setup

# 3. .bashrc のキーも更新（または setup-glm-teammate.sh を再実行）
```
