#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# --- result ファイル保護 (dispatch-worker が writeFileSync で生成するため hook 非経由) ---
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  if [[ "$FILE_PATH" =~ \.pd-dispatch/.*-result\.json$ ]]; then
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: *-result.json は dispatch-worker が生成します。Orchestrator の直接書き込みは禁止です。dispatch command を実行してください。"
      }
    }'
    exit 0
  fi
fi

# pipeline-state.json 検索（feature dir 内） — TS helper が作成した正規フォーマットのみ有効
HAS_VALID_PIPELINE=false
CURRENT_STEP=""
FOUND_STATE_FILE=""
while IFS= read -r state_file; do
  # TS helper (FilePipelineStateManager.init()) は必ず flow フィールドを設定する
  # (src/lib/pipeline-state.ts L72-87: flow は init() の必須引数)
  if jq -e '.flow' "$state_file" >/dev/null 2>&1; then
    HAS_VALID_PIPELINE=true
    FOUND_STATE_FILE="$state_file"
    break
  fi
done < <(find "$CWD/features" -name "pipeline-state.json" -maxdepth 3 2>/dev/null)

# current ステップを取得
if [[ "$HAS_VALID_PIPELINE" == "true" ]]; then
  CURRENT_STEP=$(jq -r '.current // "unknown"' "$FOUND_STATE_FILE")
fi

# --- パイプライン成果物保護 ---
# dispatch worker が生成すべき成果物への直接書き込みをブロック
PIPELINE_ARTIFACTS="spec\.md|plan\.md|tasks\.md|test-plan\.md"
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  if [[ "$FILE_PATH" =~ features/[^/]+/($PIPELINE_ARTIFACTS)$ ]]; then
    if [[ "$HAS_VALID_PIPELINE" == "true" ]]; then
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "BLOCKED: パイプライン成果物 (.md) は dispatch-worker 経由で生成してください。Orchestrator の直接書き込みは禁止です。"
        }
      }'
      exit 0
    fi
  fi
fi

# 実装ファイルかどうかチェック
if [[ "$FILE_PATH" =~ \.(html|js|jsx|ts|tsx|css|py|vue|svelte)$ ]]; then
  if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
    # Case 1: pipeline なし → ブロック
    if [[ "$HAS_VALID_PIPELINE" == "false" ]]; then
      jq -n '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "BLOCKED: pipeline-state.json が見つかりません。実装ファイルの直接書き込みは禁止です。Core Loop (node .poor-dev/dist/bin/poor-dev-next.js) を実行してパイプラインを開始してください。"
        }
      }'
      exit 0
    fi
    # Case 2: implement 以外のステップ → ブロック
    if [[ "$CURRENT_STEP" != "implement" && "$CURRENT_STEP" != "null" && "$CURRENT_STEP" != "unknown" ]]; then
      jq -n --arg step "$CURRENT_STEP" '{
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: ("BLOCKED: 現在のステップは \"" + $step + "\" です。implement ステップ以外での実装ファイルの直接書き込みは禁止です。dispatch-worker 経由でコードを生成してください。")
        }
      }'
      exit 0
    fi
  fi
fi
exit 0
