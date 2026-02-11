#!/usr/bin/env bash
# PoorDevSkills - tmux orchestration utilities
#
# Provides functions to dispatch CLI commands to tmux panes,
# wait for completion, and capture results/logs.
#
# Usage: source .poor-dev/lib/tmux.sh
#
# Functions:
#   pdtmux_available            - Check if tmux is usable (inside session + binary exists)
#   pdtmux_init [run_id]        - Initialize run directory, write state file
#   pdtmux_load                 - Restore state from state file (for cross-invocation use)
#   pdtmux_dispatch <name> <cmd...> - Dispatch command to a new tmux pane
#   pdtmux_wait_all <timeout_sec> <name...> - Block until all named tasks complete
#   pdtmux_read_result <name>   - Print task stdout from result file
#   pdtmux_exit_code <name>     - Print task exit code (0 = success)
#   pdtmux_read_log <name>      - Print latest captured pane log
#   pdtmux_cleanup              - Remove current run directory

set -euo pipefail

PDTMUX_BASE="${PDTMUX_BASE:-.poor-dev/tmux}"
PDTMUX_STATE_FILE="$PDTMUX_BASE/.current"

# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

pdtmux_available() {
  [ -n "${TMUX:-}" ] && command -v tmux &>/dev/null
}

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

pdtmux_init() {
  local run_id="${1:-run-$(date +%s)}"
  PDTMUX_RUN="$PDTMUX_BASE/$run_id"
  PDTMUX_LOGS="$PDTMUX_BASE/logs"
  mkdir -p "$PDTMUX_RUN" "$PDTMUX_LOGS"
  echo "$PDTMUX_RUN" > "$PDTMUX_STATE_FILE"
  export PDTMUX_RUN PDTMUX_LOGS
  echo "$PDTMUX_RUN"
}

pdtmux_load() {
  if [ ! -f "$PDTMUX_STATE_FILE" ]; then
    echo "ERROR: No active tmux run. Call pdtmux_init first." >&2
    return 1
  fi
  PDTMUX_RUN=$(cat "$PDTMUX_STATE_FILE")
  PDTMUX_LOGS="$PDTMUX_BASE/logs"
  export PDTMUX_RUN PDTMUX_LOGS
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

pdtmux_dispatch() {
  local name="$1"; shift
  local cmd="$*"

  local result_file="$PDTMUX_RUN/${name}.result"
  local signal_file="$PDTMUX_RUN/${name}.signal"
  local log_file="$PDTMUX_LOGS/${name}-$(date +%Y%m%d-%H%M%S).log"
  local script_file="$PDTMUX_RUN/${name}.sh"

  rm -f "$result_file" "$signal_file"

  # Write wrapper script to avoid tmux quoting issues.
  # The script runs the command, captures stdout+stderr via tee,
  # records exit code, snapshots the pane, then exits (closing the pane).
  {
    echo '#!/usr/bin/env bash'
    echo 'set -o pipefail'
    printf '%s 2>&1 | tee %s\n' "$cmd" "$result_file"
    printf 'echo ${PIPESTATUS[0]} > %s\n' "$signal_file"
    printf 'tmux capture-pane -p -S - > %s 2>/dev/null || true\n' "$log_file"
    echo 'sleep 1'
    echo 'exit 0'
  } > "$script_file"
  chmod +x "$script_file"

  tmux split-window -d "$script_file"
  tmux select-layout tiled 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Wait
# ---------------------------------------------------------------------------

pdtmux_wait_all() {
  local timeout="${1:-600}"; shift
  local names=("$@")
  local start
  start=$(date +%s)

  while true; do
    local all_done=true
    for n in "${names[@]}"; do
      if [ ! -f "$PDTMUX_RUN/${n}.signal" ]; then
        all_done=false
        break
      fi
    done
    if $all_done; then return 0; fi

    local elapsed=$(( $(date +%s) - start ))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "TIMEOUT: ${timeout}s elapsed. Still waiting on:" >&2
      for n in "${names[@]}"; do
        [ -f "$PDTMUX_RUN/${n}.signal" ] || echo "  - $n" >&2
      done
      return 1
    fi
    sleep 2
  done
}

# ---------------------------------------------------------------------------
# Result reading
# ---------------------------------------------------------------------------

pdtmux_read_result() {
  cat "$PDTMUX_RUN/${1}.result" 2>/dev/null
}

pdtmux_exit_code() {
  cat "$PDTMUX_RUN/${1}.signal" 2>/dev/null
}

pdtmux_read_log() {
  # Return the most recent log file for this name
  local latest
  latest=$(ls -t "$PDTMUX_LOGS/${1}-"*.log 2>/dev/null | head -1)
  [ -n "$latest" ] && cat "$latest"
}

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

pdtmux_cleanup() {
  [ -n "${PDTMUX_RUN:-}" ] && rm -rf "$PDTMUX_RUN"
  rm -f "$PDTMUX_STATE_FILE"
}
