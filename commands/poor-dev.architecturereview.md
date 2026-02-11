---
description: Run 4-persona architecture review with auto-fix loop until zero issues
handoffs:
  - label: 実装開始
    agent: poor-dev.implement
    prompt: アーキテクチャレビューをクリアしました。実装を開始してください
    send: true
  - label: 設計修正
    agent: poor-dev.plan
    prompt: レビュー指摘に基づいてアーキテクチャを修正してください
---

## User Input

```text
$ARGUMENTS
```

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.architecturereview` → `default`.
3. Determine execution mode per persona: if resolved `cli` matches current runtime → **native**; otherwise → **cross-CLI**. This is MANDATORY — you MUST NOT substitute native execution when cross-CLI is required.

## STEP 0.5: Dispatch Mode Detection

Check if tmux orchestration is available:

```bash
source .poor-dev/lib/tmux.sh 2>/dev/null && pdtmux_available && echo "DISPATCH=tmux" || echo "DISPATCH=fallback"
```

Record result as `DISPATCH_MODE` (`tmux` or `fallback`).

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`.
  Instruction: `"Review $ARGUMENTS. Output compact English YAML."`

  **1a. Build CLI commands** for each persona from STEP 0 config:

  ```
  FOR each persona in [architecturereview-architect, architecturereview-security, architecturereview-performance, architecturereview-sre]:
    resolved = config[persona]
    IF resolved.cli == "claude":
      cmd_<persona> = 'claude -p --model <model> --agent <persona> --no-session-persistence --output-format text "Review $ARGUMENTS. Output compact English YAML."'
    ELSE:
      cmd_<persona> = 'opencode run --model <model> --agent <persona> --format json "Review $ARGUMENTS. Output compact English YAML."'
  ```

  **1b. Dispatch & collect** — route by DISPATCH_MODE:

  ```
  IF DISPATCH_MODE == tmux:
    # ---- tmux pane dispatch (visible, parallel, with log capture) ----
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_init "archreview-$(date +%s)"

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && \
          pdtmux_dispatch architecturereview-architect "$cmd_architect" && \
          pdtmux_dispatch architecturereview-security "$cmd_security" && \
          pdtmux_dispatch architecturereview-performance "$cmd_performance" && \
          pdtmux_dispatch architecturereview-sre "$cmd_sre"

    Bash (timeout: 600000): source .poor-dev/lib/tmux.sh && pdtmux_load && \
                            pdtmux_wait_all 600 architecturereview-architect architecturereview-security architecturereview-performance architecturereview-sre

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && \
          echo "=== architecturereview-architect ===" && pdtmux_read_result architecturereview-architect && echo "---" && \
          echo "=== architecturereview-security ===" && pdtmux_read_result architecturereview-security && echo "---" && \
          echo "=== architecturereview-performance ===" && pdtmux_read_result architecturereview-performance && echo "---" && \
          echo "=== architecturereview-sre ===" && pdtmux_read_result architecturereview-sre

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_cleanup

  ELSE:
    # ---- Fallback: direct dispatch (no tmux) ----
    resolved_cli = config resolution from STEP 0
    current_cli  = runtime you are executing in ("claude" or "opencode")

    IF resolved_cli == current_cli:
      IF current_cli == "claude":
        → Task(subagent_type="architecturereview-architect", model=<resolved model>, prompt="Review $ARGUMENTS. Output compact English YAML.")
        [repeat for each persona, all 4 in parallel]
      ELSE:
        → @architecturereview-architect  (if config model == session default)
        → Bash: opencode run --model <model> --agent architecturereview-architect "Review $ARGUMENTS. Output compact English YAML."
    ELSE:
      IF resolved_cli == "opencode":
        → Bash: opencode run --model <model> --agent architecturereview-architect --format json "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
      ELSE:
        → Bash: claude -p --model <model> --agent architecturereview-architect --no-session-persistence --output-format text "Review $ARGUMENTS. Output compact English YAML." (run_in_background: true)
    Run all 4 in parallel. Wait for all to complete.
  ```

  Parse all 4 persona results (from tmux result files or tool returns).

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Fix — build fixer command from STEP 0 config for `review-fixer`.

  ```
  IF DISPATCH_MODE == tmux:
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_init "archreview-fix-$(date +%s)"
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_dispatch review-fixer "$cmd_fixer"
    Bash (timeout: 600000): source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_wait_all 600 review-fixer
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_read_result review-fixer
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_cleanup
  ELSE:
    [existing fixer dispatch — Task or Bash per config routing]
  ```

  After fix → back to STEP 1 (new sub-agents, fresh context).

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: architecture
target: $ARGUMENTS
n: 2
i: {C: ["no input validation on user endpoints (SEC)"], H: ["missing caching strategy (PERF)"]}
ps: {ARCH: GO, SEC: NO-GO, PERF: CONDITIONAL, SRE: GO}
act: FIX

# Final (0 issues):
type: architecture
target: $ARGUMENTS
v: GO
n: 6
log:
  - {n: 1, issues: 7, fixed: "SOLID violations, auth gaps"}
  - {n: 6, issues: 0}
next: /poor-dev.implement
```
