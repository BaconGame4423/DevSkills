#!/usr/bin/env bash
# tmux display-popup 内で実行される入力スクリプト。
# Tab/Shift+Tab でモード切替、Enter で確定する TUI。
# Usage: pipeline-input-popup.sh <desc_output_file>
set -euo pipefail

DESC_FILE="${1:?Usage: pipeline-input-popup.sh <desc_output_file>}"
SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE=triage

draw_screen() {
    printf "\033[2J\033[H"

    if [[ "$MODE" == "triage" ]]; then
        local border_color="141"
        local tab_line="▸ triage │ switch"
        local hint="機能説明 or バグ報告を入力..."
        local action="Enter で開始"
    else
        local border_color="214"
        local tab_line="triage │ ▸ switch"
        local hint="フローを直接選択します"
        local action="Enter で選択開始"
    fi

    gum style --border rounded --padding "1 2" --border-foreground "$border_color" \
        "$(gum style --bold --foreground 231 '◆ poor-dev pipeline')" \
        "" \
        "$(gum style --foreground 245 "$tab_line")  $(gum style --faint '⇧Tab: モード切替')"
    echo ""
    printf "  \033[38;5;245m%s\033[0m\n" "$hint"
    printf "  \033[38;5;245m%s\033[0m\n" "$action"
}

# --- メインループ: Tab/Shift+Tab でトグル、Enter で確定、Esc でキャンセル ---
while true; do
    draw_screen
    IFS= read -rsn1 key
    case "$key" in
        $'\x1b')
            read -rsn2 -t 0.1 rest || true
            if [[ "$rest" == "[Z" ]]; then
                # Shift+Tab → トグル
                [[ "$MODE" == "triage" ]] && MODE=switch || MODE=triage
            else
                # Esc 単押し → キャンセル
                [[ -z "$rest" ]] && exit 1
            fi
            ;;
        $'\t')
            # Tab → トグル
            [[ "$MODE" == "triage" ]] && MODE=switch || MODE=triage
            ;;
        "")
            # Enter → 確定して次へ
            break
            ;;
    esac
done

# --- モード別入力 ---
if [[ "$MODE" == "triage" ]]; then
    echo ""
    description=$(gum input \
        --placeholder "機能説明 or バグ報告を入力..." \
        --width 50 \
        --char-limit 500) || true
    if [[ -z "$description" ]]; then
        echo "" > "$DESC_FILE"
        exit 1
    fi
    printf '%s' "$description" > "$DESC_FILE"
else
    flow=$(bash "$SCRIPT_DIR/flow-selector.sh") || exit 1
    case "$flow" in
        ask|report)
            printf 'FLOW:%s' "$flow" > "$DESC_FILE"
            exit 0
            ;;
    esac
    echo ""
    description=$(gum input \
        --placeholder "${flow} の説明を入力..." \
        --width 50 \
        --char-limit 500) || exit 1
    if [[ -z "$description" ]]; then
        exit 1
    fi
    printf 'FLOW:%s:%s' "$flow" "$description" > "$DESC_FILE"
fi
