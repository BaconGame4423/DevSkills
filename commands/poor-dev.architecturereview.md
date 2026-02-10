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

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."
  - **Claude Code**: Task tool with subagent_type "general-purpose" for each.
  - **OpenCode**: `@architecturereview-architect`, `@architecturereview-security`, `@architecturereview-performance`, `@architecturereview-sre`.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` (priority C→H→M→L). After fix → back to STEP 1.

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
