---
description: Pipeline orchestration sub-agent — dispatches steps from classification to completion.
---

## Pipeline Context (injected by caller)

```text
$ARGUMENTS
```

Parse JSON from `$ARGUMENTS`: `flow`, `feature_dir`, `branch`, `summary`, `interactive_mode`, `completed` (array), `arguments` (original user input).

## Step 1: Pre-flight

```
OPENCODE_AVAILABLE = (command -v opencode returns 0)
OPENCODE_LOG_DIR = ~/.local/share/opencode/log
POLL_INTERVAL = config.polling.interval || 1
IDLE_TIMEOUT  = config.polling.idle_timeout || 120
MAX_TIMEOUT   = config.polling.max_timeout || config.dispatch_timeout || 600
```

If `opencode` not available → `FALLBACK_MODE = true` (dispatches use Task() with model=haiku).
Check AskUserQuestion availability → set `INTERACTIVE_MODE`.

## Step 2: Pipeline Selection

| Flow | Pipeline |
|------|----------|
| Feature | `specify → suggest → plan → planreview → tasks → tasksreview → implement → architecturereview → qualityreview → phasereview` |
| Bugfix | `bugfix → [CONDITIONAL]` |
| Investigation | `investigate` (single step) |
| Roadmap | `concept → goals → milestones → roadmap` |
| Discovery-init | `discovery` (single step) |
| Discovery-rebuild | `rebuildcheck → [CONDITIONAL]` |

Single-step pipelines (investigation, discovery-init): dispatch and return. No state tracking.

Initialize: `bash lib/pipeline-state.sh init "${FEATURE_DIR}" "${FLOW}" '${PIPELINE_JSON}'`

## Step 3: Resume Detection

```bash
STATE=$(bash lib/pipeline-state.sh read "${FEATURE_DIR}")
```

If state exists, branch on `status`:

| Status | INTERACTIVE | NON-INTERACTIVE |
|--------|------------|-----------------|
| active (or absent) | Ask: resume or restart | Auto-resume |
| paused | Ask: re-run rebuildcheck / skip to harvest / continue | PAUSE_FOR_APPROVAL("resume-paused") |
| rate-limited | Ask: resume or stop | Auto-resume (set active) |
| awaiting-approval | Type-specific ask (spec-approval/gate/review-nogo) | Auto-approve, clear pendingApproval |

If not found → start from beginning.

## Step 4: Dispatch Loop

⚠ **CRITICAL**: Each step = separate sub-agent. NEVER skip, combine, or inline step logic. Failure → STOP.

**Pre-dispatch artifact check**: plan needs spec.md, tasks needs plan.md+spec.md, implement needs spec.md+tasks.md. Missing → error stop.

For each STEP in PIPELINE (skipping completed):
- specify: already in COMPLETED array → skip
- implement: → Section D
- review steps (planreview, tasksreview, architecturereview, qualityreview, phasereview): → Section B
- conditional (bugfix, rebuildcheck): → Section C
- others: → Section A

### A. Production Steps

1. **Read**: `commands/poor-dev.${STEP}.md`
2. **Strip**: Remove YAML frontmatter (`---` to `---`), "Gate Check"/"Dashboard Update" sections. Validate no `handoffs:`/`send:` remains.
3. **Prepend**: NON_INTERACTIVE_HEADER (see Step 5)
4. **Append context** (step-filtered):
   ```
   ## Pipeline Context
   - FEATURE_DIR: ${FEATURE_DIR}  |  BRANCH: ${BRANCH}
   - Feature: ${FEATURE_SUMMARY}  |  target_file: ${TARGET_FILE}
   - Previous step: (3-line summary)
   ## Artifacts (filtered for ${STEP})
   ${FILTERED_ARTIFACTS}
   ```
   **Filter rules**:
   | Step | Include | Exclude |
   |------|---------|---------|
   | suggest | spec.md (summary) | plan.md, tasks.md, constitution |
   | plan | spec.md, research.md, suggestions.yaml, constitution(filtered) | tasks.md |
   | planreview | plan.md, spec.md (requirements) | research.md, constitution |
   | tasks | plan.md (Architecture+Phases), spec.md, constitution(filtered) | research.md |
   | tasksreview | tasks.md, spec.md (requirements), plan.md (summary) | research.md |
   | implement | tasks.md, plan.md (tech stack+files), contracts/ | research.md, constitution |
   | review 系 | target+spec.md (requirements)+review-log.yaml (windowed) | other |

   Files >10KB → extract relevant sections only. target_file: default=plan.md, bugfix-small=fix-plan.md.
   Speculation: if `speculation.pairs.specify == "suggest"` → start suggest speculatively after specify.
   Plan step: warn if `suggestions.yaml` missing (continue).

5. **Resolve model**:
   ```bash
   RESOLVED=$(bash lib/config-resolver.sh "${STEP}" .poor-dev/config.json)
   CLI=$(echo "$RESOLVED" | jq -r '.cli')
   MODEL=$(echo "$RESOLVED" | jq -r '.model')
   ```

   > **⚠ /tmp/ ファイル**: 以下のパスは poll-dispatch.sh が自動管理する。mkdir 不要。Write ツールでファイルに直接書き込むこと。

6. **Dispatch** (shell-based polling):
   Write prompt → `/tmp/poor-dev-step.txt`, dispatch command → `/tmp/poor-dev-cmd.sh`:
   - opencode: `opencode run --model <MODEL> --format json "$(cat /tmp/poor-dev-step.txt)"`
   - claude: `cat /tmp/poor-dev-step.txt | claude -p --model <MODEL> --no-session-persistence --output-format text`
   - FALLBACK_MODE: `Task(subagent_type="general-purpose", model="haiku", prompt=...)`

   Execute: `cp lib/poll-dispatch.sh /tmp/poor-dev-poll-$$.sh` → Bash(run_in_background):
   `"/tmp/poor-dev-poll-$$.sh" /tmp/poor-dev-cmd.sh /tmp/poor-dev-output-${STEP}.txt /tmp/poor-dev-progress-${STEP}.txt ${IDLE_TIMEOUT} ${MAX_TIMEOUT}`

   **Wait**: `TaskOutput(task_id, block=true, timeout=30000)` loop. Read progress_file → relay new markers.

6b. **Rate limit** (only if exit_code != 0):
   ⚠ NEVER check logs during execution.
   `RATE_LIMIT_COUNT=$(grep -c "Rate limit" "$(ls -t ${OPENCODE_LOG_DIR}/*.log | head -1)" 2>/dev/null || echo 0)`
   0 → normal error. >0 + fallback → retry. >0 + no fallback → `status: "rate-limited"`, stop.

7. **Parse output**: Check JSON summary (clarifications, errors, timeout). Verify artifacts exist.
   Plan step: display plan.md Summary+Technical Context (日本語要約).

8. **Gate**: If `gates.after-${STEP}` → INTERACTIVE: ask / NON-INTERACTIVE: PAUSE_FOR_APPROVAL("gate", STEP)
9. **Update**: `bash lib/pipeline-state.sh complete-step "${FEATURE_DIR}" "${STEP}"`
10. **Report**: "Step N/M: ${STEP} complete"

### B. Review Steps

Black-box orchestrators. Like Section A except:
- Strip: frontmatter only (no Gate Check/Dashboard removal)
- Context: FEATURE_DIR, BRANCH, target_file (variant-resolved)
- Verdict from JSON summary: GO→proceed, CONDITIONAL→ask/warn, NO-GO→ask/PAUSE_FOR_APPROVAL, null→error
- Gate + state update: same as A steps 8-9

### C. Conditional Steps (bugfix, rebuildcheck)

Dispatch via Section A, then post-process:

| Step | Marker | Variant | Continuation |
|------|--------|---------|-------------|
| bugfix | `[SCALE: SMALL]` | bugfix-small | `planreview(fix-plan.md)→implement→qualityreview→phasereview` |
| bugfix | `[SCALE: LARGE]` | bugfix-large | `plan→planreview→tasks→tasksreview→implement→architecturereview→qualityreview→phasereview` |
| bugfix | `[RECLASSIFY: FEATURE]` | — | Stop → `/poor-dev.specify` |
| rebuildcheck | `[VERDICT: REBUILD]` | discovery-rebuild | `harvest→plan→planreview→tasks→tasksreview→implement→architecturereview→qualityreview→phasereview` |
| rebuildcheck | `[VERDICT: CONTINUE]` | discovery-continue | Pause pipeline |

Update: `bash lib/pipeline-state.sh set-variant ...` + `set-pipeline ...`
CONTINUE → set paused. No marker → error. RECLASSIFY → delete state, route to specify.

### D. Parallel Implementation

Based on tasks.md Phase structure and `[P]` markers.

1. **Analyze**: `## Phase N:` headers, `[P]`/`[P:group]` markers, `files:` metadata, DAG (`depends:`)
2. **Strategy** (`config.parallel`): disabled→sequential, auto→check file overlap, explicit→as configured
3. **Dispatch**: Non-`[P]` phases sequential. `[P]` phases → parallel sub-agents (file-scoped), wait all → next Phase
4. **Recovery**: Failed→re-dispatch that task. Conflict→review-fixer. All timeout→error
5. **Progress**: Monitor `[X]` markers + PROGRESS_FILE

**Post-implement source protection**: `git diff --name-only HEAD` → if `agents/**`, `commands/**`, `lib/poll-dispatch.sh`, `.poor-dev/**` → `git checkout HEAD -- <files>` + WARNING.

## Step 5: Headers

### NON_INTERACTIVE_HEADER
```markdown
## Mode: NON_INTERACTIVE (pipeline sub-agent)
- No AskUserQuestion → use [NEEDS CLARIFICATION: ...] markers
- No Gate Check, Dashboard Update, handoffs, EnterPlanMode/ExitPlanMode
- Output progress: [PROGRESS: ...] / [REVIEW-PROGRESS: ...]
- If blocked → [ERROR: description] and stop
- File scope: FEATURE_DIR + project source only. NEVER modify: agents/, commands/, lib/, .poor-dev/, .opencode/command/, .opencode/agents/, .claude/agents/, .claude/commands/
- Shell infrastructure: mkdir・ディレクトリ作成・/tmp/ 操作は禁止。/tmp/ ファイルは poll-dispatch.sh が自動管理する
- End with: files created/modified, unresolved items
```

### PAUSE_FOR_APPROVAL(type, step, display_content)
1. Display `display_content`
2. `bash lib/pipeline-state.sh set-approval "${FEATURE_DIR}" "${TYPE}" "${STEP}"`
3. Message: "⏸ 承認待ち（${type}）。`/poor-dev` 再実行で続行。"
4. Exit pipeline.

## Step 6: Error Recovery

- **Step failure**: Stop. Artifacts preserved. Re-run `/poor-dev` to resume.
- **Manual override**: Run individual commands, then `/poor-dev` to resume.
- **Conditional pause**: `status: "paused"`. Re-run for resume.
- **Variant preservation**: Saved in state. Conditional step not re-executed on resume.
- **Spec rejection**: spec-draft.md preserved. Run `/poor-dev.specify` manually.
- **Rate limit**: Fallback → both limited → `status: "rate-limited"` → re-run.
- **Idle timeout**: kill → `status: "error"`.
