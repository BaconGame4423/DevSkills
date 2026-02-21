---
description: "Agent Teams orchestrator for all development flows"
---

# poor-dev.team — Agent Teams Orchestrator

Orchestrate development workflows using Claude Code Agent Teams.

## Phase 0: Discussion

Before creating any teams:
0. Verify TS helper exists: `ls .poor-dev/dist/bin/poor-dev-next.js` — if missing, tell user to run `npm run build` in the DevSkills source repo and re-run `poor-dev init`
1. Classify the user's request into a flow type (feature, bugfix, investigation, roadmap, discovery)
2. Discuss scope and requirements with the user
3. Create `discussion-summary.md` in the feature directory
4. No teammates are spawned during this phase

## Core Loop

After Phase 0, execute the pipeline via TS helper:

1. Run: `node .poor-dev/dist/bin/poor-dev-next.js --flow <FLOW> --state-dir <DIR> --project-dir .`
2. Parse the JSON output and execute the action:
   - `create_team` → TeamCreate + Task(spawn teammates) + monitor + TeamDelete
     **Context injection**: JSON の Context に列挙された各ファイルを Read し、
     Task の description 末尾に `## Context: {key}\n{content}` として追記する。
     50,000文字を超えるファイルは先頭50,000文字で切り詰める。
   - `create_review_team` → Opus-mediated review loop (see §Review Loop below)
   - `user_gate` → See §User Gates below
   - `done` → Report completion to user
3. After action completes: see §Conditional Steps below
4. Return to step 1

### Conditional Steps

When a step is in the flow's `conditionals` list (e.g., bugfix, rebuildcheck):
1. After teammate completes work, scan output for conditional markers:
   - `[SCALE: SMALL]` → key: `<step>:SCALE_SMALL`
   - `[SCALE: LARGE]` → key: `<step>:SCALE_LARGE`
   - `[RECLASSIFY: FEATURE]` → key: `<step>:RECLASSIFY_FEATURE`
   - `[VERDICT: REBUILD]` → key: `<step>:REBUILD`
   - `[VERDICT: CONTINUE]` → key: `<step>:CONTINUE`
2. If marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --set-conditional "<key>" --state-dir <DIR> --project-dir .`
3. If no marker found: `node .poor-dev/dist/bin/poor-dev-next.js --step-complete <step> --state-dir <DIR> --project-dir .`

### User Gates

When the TS helper returns `user_gate`:
1. Display the `message` to the user
2. Present `options` as choices
3. After user responds: `node .poor-dev/dist/bin/poor-dev-next.js --gate-response <response> --state-dir <DIR> --project-dir .`
4. Parse the returned action and continue the Core Loop

## Review Loop (Opus-Mediated, Parallel Reviewers)

For `create_review_team` actions. Initialize: `iteration = 0`, `fixed_ids = Set()`

### Step 1: Dispatch
- `iteration += 1`
- Assign review tasks to ALL N reviewers simultaneously (TaskCreate per reviewer)
- Include target files + previous review-log context in task description

### Step 2: Collect & Parse
- Reviewer メッセージ待ち。TaskList を使って完了状況を確認可能
- 外部モニターが `[MONITOR]` メッセージを送信した場合 → §Error Handling 参照
- 各レビュアー出力から以下を抽出:
  - `ISSUE: {C|H|M|L} | {description} | {file:line}`
  - `VERDICT: {GO|CONDITIONAL|NO-GO}`
- VERDICT 行なし → そのレビュアーに SendMessage で再出力依頼（最大2回）
- Deduplicate: same file:line + same severity → keep first
- Aggregate VERDICT: worst wins (NO-GO > CONDITIONAL > GO)

### Step 3: Convergence Check
- C=0 AND H=0 (fixed_ids 除外後) → review-log.yaml 更新 → commit → step complete → TeamDelete
- iteration >= max_iterations → user_gate → TeamDelete
- Otherwise → Step 4

### Step 4: Fix
- C/H イシューを fixer に SendMessage: `- [{id}] {severity} | {description} | {location}`
- Fixer が fixed/rejected YAML を返す → fixed_ids に追加
- Opus が修正ファイルを確認: コード重複 >=10行・debug 文混入 → fixer に差し戻し（最大2回）
- clean → review-log.yaml 更新 → commit → Step 1 に戻る

## Error Handling

### Monitor Nudge Response
`[MONITOR]` メッセージが入力に表示されたら:
1. 名指しされた stalled teammate に SendMessage: "Are you still working? Please respond with status."
2. 現在の作業を続行（ブロックしない）
3. 応答あり → 問題なし
4. 次のアクションサイクルでも応答なし:
   a. shutdown_request 送信 → 確認待ち
   b. 同じ agent spec で Task re-spawn → タスク再割当
   c. respawn カウント（teammate 毎最大3回）
5. 3回 respawn 後も失敗 → その reviewer なしで続行（graceful degradation）
6. 全 teammate 同時失敗 → rate limit 疑い → 120s 待機 → リトライ（最大3回）

### Other
- Review loop > max_iterations → user confirmation required
- Fixer validation failure → retry (max 2) → user confirmation
- Crash recovery → pipeline-state.json + `node .poor-dev/dist/bin/poor-dev-next.js` to resume

## Team Naming

Format: `pd-<step>-<NNN>` where NNN is from the feature directory name.

## Git Operations

All git operations (commit, push, checkout, clean) are performed by Opus only.
Teammates NEVER execute git commands.

### When to Commit
- After `create_team` for `implement` step completes: stage and commit all implementation changes
- After fixer reports modifications in a review loop: stage and commit the fixes
- After `create_team` for artifact-producing steps (specify, suggest, plan, tasks, testdesign): commit the generated artifact
- Commit message format: `type: 日本語タイトル` (per CLAUDE.md conventions)
