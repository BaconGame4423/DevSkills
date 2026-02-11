---
description: Run 4-persona phase completion review with auto-fix loop until zero issues
handoffs:
  - label: 次のフェーズ
    agent: poor-dev.implement
    prompt: フェーズ完了レビューをクリアしました。次のフェーズに進んでください
    send: true
  - label: 修正実装
    agent: poor-dev.implement
    prompt: レビュー指摘に基づいて修正を適用してください
---

## User Input

```text
$ARGUMENTS
```

## STEP 0: Config Resolution

1. Read `.poor-dev/config.json` (Bash: `cat .poor-dev/config.json 2>/dev/null`). If missing, use built-in defaults: `{ "default": { "cli": "opencode", "model": "zai-coding-plan/glm-4.7" }, "overrides": {} }`.
2. For each persona (`phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`) and for `review-fixer`, resolve config with priority: `overrides.<agent>` → `overrides.phasereview` → `default`.
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
  Personas: `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`.
  Instruction: `"Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML."`

  **1a. Build CLI commands** for each persona from STEP 0 config:

  ```
  FOR each persona in [phasereview-qa, phasereview-regression, phasereview-docs, phasereview-ux]:
    resolved = config[persona]
    IF resolved.cli == "claude":
      cmd_<persona> = 'claude -p --model <model> --agent <persona> --no-session-persistence --output-format text "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML."'
    ELSE:
      cmd_<persona> = 'opencode run --model <model> --agent <persona> --format json "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML."'
  ```

  **1b. Dispatch & collect** — route by DISPATCH_MODE:

  ```
  IF DISPATCH_MODE == tmux:
    # ---- tmux pane dispatch (visible, parallel, with log capture) ----
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_init "phasereview-$(date +%s)"

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && \
          pdtmux_dispatch phasereview-qa "$cmd_qa" && \
          pdtmux_dispatch phasereview-regression "$cmd_regression" && \
          pdtmux_dispatch phasereview-docs "$cmd_docs" && \
          pdtmux_dispatch phasereview-ux "$cmd_ux"

    Bash (timeout: 600000): source .poor-dev/lib/tmux.sh && pdtmux_load && \
                            pdtmux_wait_all 600 phasereview-qa phasereview-regression phasereview-docs phasereview-ux

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && \
          echo "=== phasereview-qa ===" && pdtmux_read_result phasereview-qa && echo "---" && \
          echo "=== phasereview-regression ===" && pdtmux_read_result phasereview-regression && echo "---" && \
          echo "=== phasereview-docs ===" && pdtmux_read_result phasereview-docs && echo "---" && \
          echo "=== phasereview-ux ===" && pdtmux_read_result phasereview-ux

    Bash: source .poor-dev/lib/tmux.sh && pdtmux_load && pdtmux_cleanup

  ELSE:
    # ---- Fallback: direct dispatch (no tmux) ----
    resolved_cli = config resolution from STEP 0
    current_cli  = runtime you are executing in ("claude" or "opencode")

    IF resolved_cli == current_cli:
      IF current_cli == "claude":
        → Task(subagent_type="phasereview-qa", model=<resolved model>, prompt="Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML.")
        [repeat for each persona, all 4 in parallel]
      ELSE:
        → @phasereview-qa  (if config model == session default)
        → Bash: opencode run --model <model> --agent phasereview-qa "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML."
    ELSE:
      IF resolved_cli == "opencode":
        → Bash: opencode run --model <model> --agent phasereview-qa --format json "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
      ELSE:
        → Bash: claude -p --model <model> --agent phasereview-qa --no-session-persistence --output-format text "Review phase $ARGUMENTS. Check all phase artifacts including code, tests, docs. Output compact English YAML." (run_in_background: true)
    Run all 4 in parallel. Wait for all to complete.
  ```

  Parse all 4 persona results (from tmux result files or tool returns).

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).
  Additionally verify Definition of Done: all tasks completed, quality gates passed, all tests passing, code review done, adversarial review passed, docs updated, no regressions, security reviewed.

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Fix — build fixer command from STEP 0 config for `review-fixer`.

  ```
  IF DISPATCH_MODE == tmux:
    Bash: source .poor-dev/lib/tmux.sh && pdtmux_init "phasereview-fix-$(date +%s)"
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
type: phase
target: $ARGUMENTS
n: 3
i: {H: ["README not updated with new API endpoints (DOCS)"], M: ["accessibility not tested (UX)", "CHANGELOG missing entry (DOCS)"]}
ps: {QA: GO, REGRESSION: GO, DOCS: CONDITIONAL, UX: CONDITIONAL}
act: FIX

# Final (0 issues):
type: phase
target: $ARGUMENTS
v: GO
n: 4
dod: {tasks: pass, gates: pass, tests: pass, review: pass, adversarial: pass, docs: pass, regression: pass, security: pass}
log:
  - {n: 1, issues: 6, fixed: "DoD gaps, test coverage"}
  - {n: 4, issues: 0}
next: /poor-dev.implement (next phase)
```

### Dashboard Update

Update living documents in `docs/`:

1. `mkdir -p docs`
2. Scan all `specs/*/` directories. For each feature dir, check artifact existence:
   - discovery-memo.md, learnings.md, spec.md, plan.md, tasks.md, bug-report.md
   - concept.md, goals.md, milestones.md, roadmap.md (roadmap flow)
3. Determine each feature's phase from latest artifact:
   Discovery → Specification → Planning → Tasks → Implementation → Review → Complete
4. Write `docs/progress.md`:
   - Header with timestamp and triggering command name
   - Per-feature section: branch, phase, artifact checklist (✅/⏳/—), last activity
5. Write `docs/roadmap.md`:
   - Header with timestamp
   - Active features table (feature, phase, status, branch)
   - Completed features table
   - Upcoming section (from concept.md/goals.md/milestones.md if present)
