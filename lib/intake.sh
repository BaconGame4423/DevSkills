#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Usage: intake.sh --flow <flow> --project-dir <dir> [--input-file <file>]
#
# Reads user input from stdin (heredoc) or --input-file, then:
#   1. Generates short-name from input text
#   2. Creates branch + feature directory via branch-setup.sh
#   3. Dispatches specify step (readonly) via compose-prompt.sh + dispatch-step.sh
#   4. Extracts spec text and saves to spec.md
#   5. Runs remaining pipeline via pipeline-runner.sh
#
# stdin: user input text (via heredoc)
# stdout: JSONL progress events
# exit code: 0=complete, 1=error, 2=NO-GO, 3=rate-limit

# --- Argument parsing ---

FLOW=""
INPUT_FILE=""
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --flow)        FLOW="$2"; shift 2 ;;
    --input-file)  INPUT_FILE="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    *)             echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
: "${FLOW:?--flow is required}"

# --- Read user input from stdin or --input-file ---

TEMP_INPUT="/tmp/poor-dev-intake-input-$$.txt"
if [[ -n "$INPUT_FILE" && -f "$INPUT_FILE" ]]; then
  cp "$INPUT_FILE" "$TEMP_INPUT"
elif [[ ! -t 0 ]]; then
  cat > "$TEMP_INPUT"
else
  echo '{"event":"error","reason":"No input provided (use stdin or --input-file)"}' >&2
  exit 1
fi

if [[ ! -s "$TEMP_INPUT" ]]; then
  echo '{"event":"error","reason":"Empty input"}' >&2
  rm -f "$TEMP_INPUT"
  exit 1
fi

INPUT=$(cat "$TEMP_INPUT")
echo '{"event":"intake_started","flow":"'"$FLOW"'"}'

# --- 1. Short-name generation ---

SHORT_NAME=$(echo "$INPUT" | sed 's/[^a-zA-Z0-9 ]//g' | \
  awk '{for(i=1;i<=NF&&i<=4;i++) printf "%s%s",$i,(i<4&&i<NF?"-":"")}' | \
  tr '[:upper:]' '[:lower:]' | cut -c1-30)

# Fallback for non-ASCII input (e.g., all Japanese)
if [[ -z "$SHORT_NAME" ]]; then
  SHORT_NAME="${FLOW}-$(date +%H%M%S)"
fi

# --- 2. Branch creation (must run in project directory) ---

cd "$PROJECT_DIR"

BRANCH_STDERR="/tmp/poor-dev-branch-stderr-$$.txt"
BRANCH_RESULT=$(bash "$SCRIPT_DIR/branch-setup.sh" "$SHORT_NAME" 2>"$BRANCH_STDERR") || {
  BRANCH_ERR=$(cat "$BRANCH_STDERR" 2>/dev/null || true)
  echo '{"event":"branch_error","output":'"$(echo "$BRANCH_ERR" | jq -R -s '.')"'}'
  rm -f "$TEMP_INPUT" "$BRANCH_STDERR"
  exit 1
}
rm -f "$BRANCH_STDERR"
BRANCH=$(echo "$BRANCH_RESULT" | jq -r '.branch')
FEATURE_DIR=$(echo "$BRANCH_RESULT" | jq -r '.feature_dir')
FD="$PROJECT_DIR/$FEATURE_DIR"
echo '{"event":"branch_created","branch":"'"$BRANCH"'","feature_dir":"'"$FEATURE_DIR"'"}'

# --- 3. Spec dispatch (readonly) ---

echo '{"event":"specify","status":"starting"}'
rm -f /tmp/poor-dev-output-specify-*.txt 2>/dev/null || true

PROMPT_FILE="/tmp/poor-dev-specify-$$.txt"

# Resolve command file (commands/ → .opencode/command/ fallback)
SPECIFY_CMD="$PROJECT_DIR/commands/poor-dev.specify.md"
[[ ! -f "$SPECIFY_CMD" ]] && SPECIFY_CMD="$PROJECT_DIR/.opencode/command/poor-dev.specify.md"

if [[ ! -f "$SPECIFY_CMD" ]]; then
  echo '{"event":"specify","status":"error","reason":"poor-dev.specify.md not found"}'
  rm -f "$TEMP_INPUT"
  exit 1
fi

bash "$SCRIPT_DIR/compose-prompt.sh" \
  "$SPECIFY_CMD" "$PROMPT_FILE" \
  --header non_interactive --header readonly \
  --context "input=$TEMP_INPUT"

DISPATCH_EXIT=0
bash "$SCRIPT_DIR/dispatch-step.sh" specify "$PROJECT_DIR" "$PROMPT_FILE" 120 600 2>&1 || DISPATCH_EXIT=$?

rm -f "$TEMP_INPUT" "$PROMPT_FILE" 2>/dev/null || true

if [[ "$DISPATCH_EXIT" -ne 0 ]]; then
  echo '{"event":"specify","status":"error","exit_code":'"$DISPATCH_EXIT"'}'
  exit 1
fi

# --- 4. Extract spec text ---

SPEC_OUTPUT=$(ls -t /tmp/poor-dev-output-specify-*.txt 2>/dev/null | head -1)
if [[ -n "$SPEC_OUTPUT" && -f "$SPEC_OUTPUT" ]]; then
  jq -r 'select(.type=="text") | .part.text // empty' "$SPEC_OUTPUT" 2>/dev/null | \
    sed '/^\[BRANCH:/d' > "$FD/spec.md"
fi

if [[ ! -f "$FD/spec.md" ]] || [[ ! -s "$FD/spec.md" ]]; then
  echo '{"event":"specify","status":"error","reason":"spec.md not extracted"}'
  exit 1
fi
echo '{"event":"specify","status":"complete","file":"'"$FEATURE_DIR/spec.md"'"}'

# --- 5. Pipeline runner ---

echo '{"event":"pipeline","status":"starting"}'
PIPELINE_EXIT=0
bash "$SCRIPT_DIR/pipeline-runner.sh" \
  --flow "$FLOW" \
  --feature-dir "$FEATURE_DIR" \
  --branch "$BRANCH" \
  --project-dir "$PROJECT_DIR" \
  --completed specify \
  --summary "$INPUT" || PIPELINE_EXIT=$?

echo '{"event":"pipeline","status":"complete","exit_code":'"$PIPELINE_EXIT"'}'
exit $PIPELINE_EXIT
