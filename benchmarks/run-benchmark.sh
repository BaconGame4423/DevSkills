#!/usr/bin/env bash
# ============================================================
# run-benchmark.sh - ベンチマーク実行スクリプト
# ============================================================
# Usage:
#   ./benchmarks/run-benchmark.sh <combo> [version]
#       セットアップ + opencode 起動 + 完了後にメトリクス収集
#
#   ./benchmarks/run-benchmark.sh --collect <combo>
#       メトリクス収集のみ
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$SCRIPT_DIR/benchmarks.json"
DEVSKILLS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- 色定義 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# --- 前提条件チェック ---
if ! command -v jq &>/dev/null; then
  err "jq が必要です。先にインストールしてください。"
  exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
  err "$CONFIG が見つかりません"
  exit 1
fi

# --- JSON ヘルパー ---
jval() { jq -r "$1" "$CONFIG"; }

# --- 引数解析 ---
COLLECT_ONLY=false
COMBO=""
VERSION=""

if [[ "${1:-}" == "--collect" ]]; then
  COLLECT_ONLY=true
  COMBO="${2:-}"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage:"
  echo "  $0 <combo> [version]    セットアップ + opencode 起動 + メトリクス収集"
  echo "  $0 --collect <combo>    メトリクス収集のみ"
  echo ""
  echo "Arguments:"
  echo "  combo    ベンチマーク組み合わせ名 (e.g. glm5_all, m2.5_all)"
  echo "  version  PoorDevSkills バージョン (デフォルト: package.json の version)"
  exit 0
else
  COMBO="${1:-}"
  VERSION="${2:-}"
fi

if [[ -z "$COMBO" ]]; then
  err "combo を指定してください"
  echo ""
  echo "利用可能な組み合わせ:"
  jq -r '.combinations[].dir_name' "$CONFIG" | sed 's/^/  /'
  exit 1
fi

# --- combo 存在確認 ---
COMBO_INDEX=$(jq -r --arg c "$COMBO" '[.combinations[].dir_name] | to_entries[] | select(.value == $c) | .key' "$CONFIG")
if [[ -z "$COMBO_INDEX" ]]; then
  err "不明な combo: $COMBO"
  echo "利用可能な組み合わせ:"
  jq -r '.combinations[].dir_name' "$CONFIG" | sed 's/^/  /'
  exit 1
fi

# --- バージョン解決 ---
if [[ -z "$VERSION" ]]; then
  VERSION=$(jq -r '.version' "$DEVSKILLS_DIR/package.json")
fi

TARGET_DIR="$SCRIPT_DIR/$COMBO"

# ============================================================
# build_prompt: benchmarks.json からプロンプトを動的構築
# ============================================================
build_prompt() {
  local task_name task_desc requirements prompt

  task_name=$(jval '.task.name')
  task_desc=$(jval '.task.description')
  requirements=$(jq -r '.task.requirements[] | "- \(.id): \(.name)"' "$CONFIG")

  prompt="/poor-dev ${task_desc}「${task_name}」を開発してください。
要件:
${requirements}"

  echo "$prompt"
}

# ============================================================
# setup_environment: 環境セットアップ
# ============================================================
setup_environment() {
  info "=== ベンチマーク環境セットアップ: $COMBO (v$VERSION) ==="
  echo ""

  # 1) .poor-dev-version 更新（scaffold 側）
  info ".poor-dev-version を $VERSION に更新"
  echo "$VERSION" > "$SCRIPT_DIR/_scaffold/common/.poor-dev-version"

  # 2) setup-benchmarks.sh 実行（ディレクトリ未作成時）
  if [[ ! -d "$TARGET_DIR" ]]; then
    info "setup-benchmarks.sh を実行（ディレクトリ未作成）"
    bash "$SCRIPT_DIR/setup-benchmarks.sh"
    ok "セットアップ完了"
  else
    # 既存ディレクトリがあってもスキルファイルを最新に更新
    info "既存ディレクトリを検出。スキルファイルを更新"
    bash "$SCRIPT_DIR/setup-benchmarks.sh" --update
    ok "スキルファイル更新完了"
  fi

  # 3) .poor-dev-version をターゲットにも反映
  echo "$VERSION" > "$TARGET_DIR/.poor-dev-version"

  # 4) パイプライン補完: setup-benchmarks.sh が除外しているファイルを補完
  info "パイプライン補完（pipeline.md, lib/, commands/）"

  # pipeline.md コピー
  local pipeline_src=""
  if [[ -f "$DEVSKILLS_DIR/commands/poor-dev.pipeline.md" ]]; then
    pipeline_src="$DEVSKILLS_DIR/commands/poor-dev.pipeline.md"
  elif [[ -f "$DEVSKILLS_DIR/.opencode/command/poor-dev.pipeline.md" ]]; then
    pipeline_src="$DEVSKILLS_DIR/.opencode/command/poor-dev.pipeline.md"
  fi

  if [[ -n "$pipeline_src" ]]; then
    cp "$pipeline_src" "$TARGET_DIR/.opencode/command/poor-dev.pipeline.md"
    # claude variant の場合 symlink も作成
    if [[ -d "$TARGET_DIR/.claude/commands" ]]; then
      ln -sf "../../.opencode/command/poor-dev.pipeline.md" "$TARGET_DIR/.claude/commands/poor-dev.pipeline.md"
    fi
    ok "pipeline.md をコピー"
  else
    warn "pipeline.md が見つかりません"
  fi

  # lib/ symlink（存在しない場合のみ）
  if [[ ! -e "$TARGET_DIR/lib" ]]; then
    ln -s "$DEVSKILLS_DIR/lib" "$TARGET_DIR/lib"
    ok "lib/ symlink を作成"
  fi

  # commands/ symlink（存在しない場合のみ）
  if [[ ! -e "$TARGET_DIR/commands" ]]; then
    ln -s "$DEVSKILLS_DIR/commands" "$TARGET_DIR/commands"
    ok "commands/ symlink を作成"
  fi

  # 5) git commit（.git が存在する場合のみ）
  if [[ -d "$TARGET_DIR/.git" ]]; then
    (
      cd "$TARGET_DIR"
      if [[ -n "$(git status --porcelain)" ]]; then
        git add -A
        git commit -q -m "benchmark setup: pipeline補完 + version $VERSION"
        ok "パイプライン補完をコミット"
      fi
    )
  fi

  echo ""
  ok "環境セットアップ完了"
}

# ============================================================
# collect_and_summarize: メトリクス収集 + サマリ出力
# ============================================================
collect_and_summarize() {
  local start_ts="${1:-0}"

  info "=== メトリクス収集: $COMBO ==="
  echo ""

  # 1) collect-metrics.sh 実行
  if [[ -x "$SCRIPT_DIR/reviews/collect-metrics.sh" ]]; then
    bash "$SCRIPT_DIR/reviews/collect-metrics.sh" "$COMBO"
  else
    warn "collect-metrics.sh が見つかりません。スキップ"
  fi

  echo ""

  # 2) review YAML テンプレート複製
  local review_dir="$SCRIPT_DIR/reviews"
  local review_file="$review_dir/${COMBO}.review.yaml"
  local template="$review_dir/_templates/benchmark-review.yaml"

  if [[ -f "$template" && ! -f "$review_file" ]]; then
    cp "$template" "$review_file"
    # meta セクションにディレクトリ名とバージョンを記録
    sed -i "s/^  directory: \"\"/  directory: \"$COMBO\"/" "$review_file"
    sed -i "s/^  review_date: \"\"/  review_date: \"$(date +%Y-%m-%d)\"/" "$review_file"
    ok "レビューテンプレートを作成: $review_file"
  elif [[ -f "$review_file" ]]; then
    info "レビューファイルは既に存在: $review_file"
  fi

  # 3) バージョン記録
  if [[ -f "$review_file" ]]; then
    # status を initial に設定（未記入の場合）
    if grep -q 'status: ""' "$review_file"; then
      sed -i 's/^  status: ""/  status: "initial"/' "$review_file"
    fi
  fi

  echo ""

  # 4) サマリ出力
  echo -e "${BOLD}============================================================${NC}"
  echo -e "${BOLD}  ベンチマーク完了サマリ: $COMBO${NC}"
  echo -e "${BOLD}============================================================${NC}"
  echo ""

  # 成果物一覧
  echo -e "${CYAN}--- 成果物 ---${NC}"
  for artifact in spec.md plan.md tasks.md review-log.yaml; do
    if [[ -f "$TARGET_DIR/$artifact" ]]; then
      echo -e "  ${GREEN}[x]${NC} $artifact"
    else
      echo -e "  ${RED}[ ]${NC} $artifact"
    fi
  done
  echo ""

  # ファイル統計
  echo -e "${CYAN}--- ファイル統計 ---${NC}"
  local file_count=0
  local total_lines=0
  for f in "$TARGET_DIR"/*.html "$TARGET_DIR"/*.js "$TARGET_DIR"/*.css "$TARGET_DIR"/*.ts "$TARGET_DIR"/*.py; do
    [[ -f "$f" ]] || continue
    file_count=$((file_count + 1))
    local lines
    lines=$(wc -l < "$f")
    total_lines=$((total_lines + lines))
    printf "  %-40s %6d lines\n" "$(basename "$f")" "$lines"
  done
  echo "  合計: ${file_count} ファイル, ${total_lines} 行"
  echo ""

  # git 履歴
  echo -e "${CYAN}--- git 履歴 ---${NC}"
  if [[ -d "$TARGET_DIR/.git" ]]; then
    local commit_count
    commit_count=$(git -C "$TARGET_DIR" rev-list --all --count 2>/dev/null || echo 0)
    echo "  コミット数: $commit_count"
    git -C "$TARGET_DIR" log --oneline --all -5 2>/dev/null | sed 's/^/  /'
  else
    echo "  git リポジトリなし"
  fi
  echo ""

  # 経過時間
  if [[ "$start_ts" -gt 0 ]]; then
    local end_ts elapsed_s elapsed_m elapsed_h
    end_ts=$(date +%s)
    elapsed_s=$((end_ts - start_ts))
    elapsed_m=$((elapsed_s / 60))
    elapsed_h=$((elapsed_m / 60))
    local remaining_m=$((elapsed_m % 60))

    echo -e "${CYAN}--- 経過時間 ---${NC}"
    if [[ $elapsed_h -gt 0 ]]; then
      echo "  ${elapsed_h}h ${remaining_m}m (${elapsed_s}s)"
    elif [[ $elapsed_m -gt 0 ]]; then
      echo "  ${elapsed_m}m $((elapsed_s % 60))s"
    else
      echo "  ${elapsed_s}s"
    fi
    echo ""
  fi

  # レビューファイルの案内
  echo -e "${CYAN}--- 次のステップ ---${NC}"
  echo "  1. $review_file を記入してレビューを完了"
  echo "  2. poor-dev benchmark compare で COMPARISON.md を更新"
  echo ""
  echo -e "${BOLD}============================================================${NC}"
}

# ============================================================
# メイン処理
# ============================================================

if [[ "$COLLECT_ONLY" == true ]]; then
  # --collect モード: メトリクス収集のみ
  if [[ ! -d "$TARGET_DIR" ]]; then
    err "ディレクトリが見つかりません: $TARGET_DIR"
    exit 1
  fi
  collect_and_summarize 0
  exit 0
fi

# --- フル実行モード ---
START_TS=$(date +%s)

# 1) 環境セットアップ
setup_environment

# 2) プロンプト構築
PROMPT=$(build_prompt)

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  opencode をインタラクティブに起動します${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "${YELLOW}以下のプロンプトを opencode に入力してください:${NC}"
echo ""
echo -e "${GREEN}────────────────────────────────────────${NC}"
echo "$PROMPT"
echo -e "${GREEN}────────────────────────────────────────${NC}"
echo ""
echo -e "${CYAN}手順:${NC}"
echo "  1. opencode 起動後、上記プロンプトをコピー＆ペースト"
echo "  2. QuestionTool（承認ゲート）が出たら承認"
echo "  3. パイプライン完走後、opencode を /exit で終了"
echo ""
info "opencode を起動中..."
echo ""

# 3) opencode インタラクティブ起動
(cd "$TARGET_DIR" && opencode)

# 4) opencode 終了後: メトリクス収集 + サマリ
echo ""
info "opencode が終了しました。メトリクス収集を開始..."
echo ""

collect_and_summarize "$START_TS"
