---
description: Execute implementation planning workflow using a plan template to generate design artifacts. Specify phase to create phase-specific plan files.
handoffs:
  - label: Plan Review
    agent: poor-dev.planreview
    prompt: Review the plan for quality and completeness
    send: true
  - label: Create Checklist
    agent: poor-dev.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider user input before proceeding (if not empty).

## Outline

1. **Phase Selection**: Check if user specified a phase (e.g., `phase0`, `phase1`, `phase2`, etc.)
   - If no phase specified or phase is `all`: Create complete plan (default behavior)
   - If specific phase specified: Create only that phase's plan file

2. **Setup**: Run `.poor-dev/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

3. **Load context**: Read FEATURE_SPEC and `.poor-dev/memory/constitution.md`. Load IMPL_PLAN template (already copied).

4. **Execute plan workflow**: Based on phase selection:
   - **Complete plan (no phase specified or `all`)**: Execute all phases (Phase 0 + Phase 1)
   - **Phase 0 only**: Execute research phase only
   - **Phase 1 only**: Execute design phase only (requires research.md to exist)
   - Follow structure in IMPL_PLAN template to generate appropriate artifacts

5. **Stop and report**: Command ends after planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phase-Specific Planning

### When No Phase Specified (Complete Plan)

Execute both Phase 0 and Phase 1:

**Phase 0: Outline & Research**
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

**Phase 1: Design & Contracts**

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Agent context update**:
   - Run `.poor-dev/scripts/bash/update-agent-context.sh opencode`
   - These scripts detect which AI agent is in use
   - Update appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

### When Phase 0 Specified

Execute only Phase 0: Outline & Research

**Output**: research.md only

### When Phase 1 Specified

Execute only Phase 1: Design & Contracts

**Prerequisites**: `research.md` must exist (skip if missing with warning)

**Output**: data-model.md, /contracts/*, quickstart.md, agent-specific file

## Phase-Specific File Naming

When creating plan files for specific phases, use the following naming convention:

- **Complete plan**: `plan.md` (contains Phase 0 and Phase 1 outputs)
- **Phase 0 only**: Create `research.md` only in specs directory
- **Phase 1 only**: Create `data-model.md`, `contracts/`, and `quickstart.md` in specs directory

**Usage Examples**:

```bash
# Create complete plan (all phases)
/poor-dev.plan

# Create only Phase 0 (research)
/poor-dev.plan phase0

# Create only Phase 1 (design)
/poor-dev.plan phase1
```

## Key Rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- When phase is specified, only generate artifacts for that phase
- Phase 1 requires research.md to exist; skip with warning if missing

## Pipeline Continuation

**This section executes ONLY after all skill work is complete (step 5 reporting done).**

1. **Check for pipeline state**: Look for `FEATURE_DIR/workflow-state.yaml`:
   - **Not found** → Standalone mode. Report completion as normal (existing behavior). Skip remaining steps.
   - **Found** → Pipeline mode. Continue below.

2. **Preemptive summary** (3-5 lines): Compose a summary including:
   - Generated/modified artifact paths (plan.md, research.md, data-model.md, contracts/, quickstart.md)
   - Key technical decisions made during planning
   - Phase(s) executed (phase0, phase1, or all)

3. **Update state**:
   ```bash
   .poor-dev/scripts/bash/pipeline-state.sh update "$FEATURE_DIR" plan completed --summary "<summary>"
   ```

4. **Get next step**:
   ```bash
   NEXT=$(.poor-dev/scripts/bash/pipeline-state.sh next "$FEATURE_DIR")
   ```

5. **Transition based on mode** (read `pipeline.mode` and `pipeline.confirm` from state):

   **auto + confirm=true (default)**:
   - **Claude Code**: Use `AskUserQuestion` tool with:
     - question: "Pipeline: plan completed. Next is /poor-dev.$NEXT"
     - options: "Continue" / "Skip" / "Pause"
   - **OpenCode**: Use `question` tool with same content.
   - On "Continue" → invoke `/poor-dev.$NEXT`
   - On "Skip" → update that step to `skipped`, get next, ask again
   - On "Pause" → set mode to `paused`, report how to resume

   **auto + confirm=false**: Immediately invoke `/poor-dev.$NEXT`

   **manual / paused**: Report completion + suggest: "Next: `/poor-dev.$NEXT`. Run `/poor-dev.pipeline resume` to continue."

6. **Error fallback**:
   - If question tool fails → report as text: "Next: `/poor-dev.$NEXT`. Use `/poor-dev.pipeline resume` to continue."
   - If state update fails → warn but do not affect main skill output
