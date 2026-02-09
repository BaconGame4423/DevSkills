#!/usr/bin/env bash
# tmux display-popup 内で実行される入力スクリプト。
# gum を使った TUI 入力 UI を提供する。
# Usage: pipeline-input-popup.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-input-popup.sh <desc_output_file>}"

# ヘッダー
gum style --border rounded --padding "1 2" --border-foreground "141" \
    "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" \
    "" \
    "$(gum style --foreground 245 'AI-powered development pipeline')"
echo ""

# 入力
description=$(gum input \
    --placeholder "機能説明 or バグ報告を入力..." \
    --width 50 \
    --char-limit 500) || true

if [[ -z "$description" ]]; then
    echo "" > "$DESC_FILE"
    exit 1
fi

printf '%s' "$description" > "$DESC_FILE"
