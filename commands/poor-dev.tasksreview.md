---
description: Run 4-persona tasks review with auto-fix loop until zero issues
handoffs:
  - label: 実装開始
    agent: poor-dev.implement
    prompt: タスクレビューをクリアしました。実装を開始してください
    send: true
  - label: タスク再調整
    agent: poor-dev.tasks
    prompt: レビュー指摘に基づいてタスクを修正してください
---

## User Input

```text
$ARGUMENTS
```

## Review Loop

Loop STEP 1-4 until 0 issues. Safety: confirm with user after 10 iterations.

**STEP 1**: Spawn 4 NEW parallel sub-agents (never reuse — prevents context contamination).
  Personas: `tasksreview-techlead`, `tasksreview-senior`, `tasksreview-devops`, `tasksreview-junior`.
  Instruction: "Review `$ARGUMENTS`. Output compact English YAML."
  - **Claude Code**: Task tool with subagent_type "general-purpose" for each.
  - **OpenCode**: `@tasksreview-techlead`, `@tasksreview-senior`, `@tasksreview-devops`, `@tasksreview-junior`.

**STEP 2**: Aggregate 4 YAML results. Count issues by severity (C/H/M/L).
  Additionally check: no circular dependencies, critical path identified, parallelization opportunities noted, user story coverage complete.

**STEP 3**: Issues remain → STEP 4. Zero issues → done, output final result.

**STEP 4**: Spawn `review-fixer` (priority C→H→M→L). After fix → back to STEP 1.

Track issue count per iteration; verify decreasing trend.

## Output Format

```yaml
# Iteration example:
type: tasks
target: $ARGUMENTS
n: 2
i: {H: ["circular dependency between task 3 and 5 (TECHLEAD)"], M: ["missing monitoring task (DEVOPS)"]}
ps: {TECHLEAD: CONDITIONAL, SENIOR: GO, DEVOPS: CONDITIONAL, JUNIOR: GO}
act: FIX

# Final (0 issues):
type: tasks
target: $ARGUMENTS
v: GO
n: 5
log:
  - {n: 1, issues: 8, fixed: "dependency graph, task sizing"}
  - {n: 5, issues: 0}
next: /poor-dev.implement
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
