---
description: Manage the development pipeline - resume after context loss or check pipeline status.
---

## User Input

```text
$ARGUMENTS
```

## Subcommands

Parse `$ARGUMENTS` for the subcommand: `resume` or `status`. If empty, default to `status`.

---

### `resume` — Resume pipeline from current state

Use this after context loss (compaction, new conversation, etc.) to continue the pipeline.

1. **Locate feature directory**: Run `.poor-dev/scripts/bash/check-prerequisites.sh --json --paths-only` to get FEATURE_DIR.

2. **Load state**: Read `FEATURE_DIR/workflow-state.yaml`.
   - If not found → report "No pipeline state found. Use `/poor-dev.specify` to start a new feature." and stop.

3. **Restore context**: From the state file, extract:
   - `feature.branch` — current branch name
   - `feature.dir` — feature directory path
   - `last_step_summary` — what happened in the previous step
   - `context.spec_file`, `context.plan_file`, `context.tasks_file` — key artifact paths

4. **Determine current step**:
   - Scan `pipeline.steps` for any step with `status: in_progress` → resume that step.
   - If none in progress, use `.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR"` to get the next pending step.
   - If result is `done` → report "Pipeline complete! All steps finished." and stop.

5. **Report context summary**:
   ```
   Pipeline Resume
   ===============
   Feature: <feature.name>
   Branch:  <feature.branch>
   Last:    <last completed step> — <last_step_summary>
   Next:    <next step to execute>
   ```

6. **Execute next step**:
   - Update the step to `in_progress`:
     ```bash
     .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" <step-id> in_progress
     ```
   - Invoke the corresponding skill: `/poor-dev.<step-id>`

---

### `status` — Show pipeline progress

1. **Locate feature directory**: Run `.poor-dev/scripts/bash/check-prerequisites.sh --json --paths-only` to get FEATURE_DIR.

2. **Load state**: Read `FEATURE_DIR/workflow-state.yaml`.
   - If not found → report "No pipeline state found." and stop.

3. **Display progress table**:

   ```
   Pipeline Status: <feature.name>
   Branch: <feature.branch>
   Mode: <pipeline.mode> (confirm: <pipeline.confirm>)

   | #  | Step               | Status      | Notes          |
   |----|---------------------|-------------|----------------|
   | 1  | specify            | completed   |                |
   | 2  | clarify            | skipped     | (conditional)  |
   | 3  | plan               | completed   |                |
   | 4  | planreview         | in_progress | ← current      |
   | 5  | tasks              | pending     |                |
   | 6  | tasksreview        | pending     |                |
   | 7  | architecturereview | pending     |                |
   | 8  | implement          | pending     |                |
   | 9  | qualityreview      | pending     |                |
   | 10 | phasereview        | pending     |                |

   Last summary: <last_step_summary>
   ```

4. **Show available actions**:
   - If paused: "Pipeline is paused. Run `/poor-dev.pipeline resume` to continue."
   - If active: "Next step: `/poor-dev.<next-step>`. Run `/poor-dev.pipeline resume` to execute."

---

## Key Rules

- Always use absolute paths from the state file.
- If `pipeline-state.sh` or `yq` is not available, report the error clearly and suggest manual steps.
- Do not modify any artifacts — this command only reads state and dispatches to other skills.
- The `resume` command is the primary recovery mechanism after context compaction.
