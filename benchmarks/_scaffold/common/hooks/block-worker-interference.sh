#!/bin/bash
# block-worker-interference.sh
# dispatch ワーカー実行中に kill/pgrep 等のプロセス操作コマンドをブロックする。
# pgrep は exec claude で動作するワーカーに対して false negative を返すため、
# 誤判断 → kill → 直接実装の連鎖を防止する。
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
[ "$TOOL_NAME" != "Bash" ] && exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# kill/pgrep 系コマンドが含まれていなければ早期 exit
echo "$COMMAND" | grep -qE '\b(kill|pkill|killall|pgrep|pidof)\b' || exit 0

# dispatch 中かどうか (.pid ファイルの存在 + プロセス生存確認)
DISPATCH_ACTIVE=false
while IFS= read -r pid_file; do
  PID=$(cat "$pid_file" 2>/dev/null | tr -d '[:space:]')
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    DISPATCH_ACTIVE=true
    break
  fi
done < <(find "$CWD/features" -path '*/.pd-dispatch/*.pid' -maxdepth 4 2>/dev/null)

if [[ "$DISPATCH_ACTIVE" == "true" ]]; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: dispatch ワーカーが実行中です。プロセスの kill/検査は禁止されています。ワーカーは exec claude で動作するため pgrep は常に false negative を返します。action.pollCommand を実行して完了を待ってください。"
    }
  }'
  exit 0
fi
exit 0
