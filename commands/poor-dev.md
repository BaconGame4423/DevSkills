---
description: Intake user input and route to the appropriate flow: feature, bugfix, roadmap, discovery, Q&A, or documentation.
handoffs:
  - label: Feature Specification
    agent: poor-dev.specify
    prompt: Create a specification for this feature request
    send: true
  - label: Bug Fix Investigation
    agent: poor-dev.bugfix
    prompt: Investigate and fix this bug report
    send: true
  - label: Roadmap Concept
    agent: poor-dev.concept
    prompt: Start roadmap concept exploration
    send: true
  - label: Discovery Flow
    agent: poor-dev.discovery
    prompt: Start discovery flow for exploration and prototyping
    send: true
  - label: Ask Question
    agent: poor-dev.ask
    prompt: Answer a question about the codebase
    send: true
  - label: Generate Report
    agent: poor-dev.report
    prompt: Generate a project report
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text after the command **is** the user's request. Do not ask them to repeat it unless empty.

### Step 1: Input Classification

Analyze `$ARGUMENTS` through a 3-stage process.

**1a. Intent Detection**: Classify by what the user wants to accomplish:
- **Feature**: user wants to add, create, or implement new functionality
- **Bugfix**: user reports an error, crash, broken behavior, or regression
- **Roadmap**: user wants to plan strategy, define vision, or explore concepts at project level
- **Discovery**: user wants to prototype, explore ideas, rebuild existing code, or "just try something"
- **Q&A**: user asks a question about the codebase or architecture
- **Documentation**: user requests a report, summary, or document generation

**Priority rule**: Feature / Bugfix / Roadmap / Discovery signals take precedence over Q&A / Documentation. Example: "How do I implement X?" → Feature (not Q&A), because the intent is implementation.

**1b. Contextual Analysis** (when intent is ambiguous):
- Problem description ("X happens", "X doesn't work") → bugfix
- Desired state ("I want X", "add X") → feature
- Planning/strategy ("plan for X", "strategy") → roadmap
- Exploration ("try X", "prototype", "rebuild", "vibe coding") → discovery
- Question ("what is X", "how does X work") → Q&A
- Report request ("summarize X", "list all X") → documentation
- Improvement/change ("optimize X", "improve X") → ambiguous

**1c. Confidence**: High / Medium / Low

### Step 2: Clarify if Ambiguous

If confidence is Medium or below, ask user to choose:
1. "機能リクエスト（新機能・拡張）"
2. "バグ報告（既存機能の不具合・異常動作）"
3. "ロードマップ・戦略策定（プロジェクト企画段階）"
4. "探索・プロトタイプ（まず作って学ぶ / 既存コードを整理して再構築）"
5. "質問・ドキュメント作成（パイプライン不要）"
6. "もう少し詳しく説明する"

If "もう少し詳しく" → re-classify. If option 5 → follow-up: ask/report.

**Non-pipeline shortcut**: Q&A / Documentation → skip Step 3, go to Step 4D/4E.
**Discovery shortcut**: → skip Step 3, go to Step 4F (branch handled by `/poor-dev.discovery`).

### Step 3: Branch & Directory Creation (pipeline flows only)

1. Generate short name (2-4 words): action-noun for features, `fix-` prefix for bugs. Preserve technical terms.
2. Create feature branch:
   ```bash
   git fetch --all --prune
   ```
   Find highest number N across remote branches, local branches, specs directories. Use N+1.
   ```bash
   git checkout -b NNN-short-name
   mkdir -p specs/NNN-short-name
   ```

### Step 4: Routing

**4A Feature**: Report "Classified as feature: <summary>". Next: `/poor-dev.specify`

**4B Bugfix**:
1. Check `bug-patterns.md` for similar past patterns. If found, inform user.
2. Create `$FEATURE_DIR/bug-report.md`:

   ```markdown
   # Bug Report: [BUG SHORT NAME]

   **Branch**: `[###-fix-bug-name]`
   **Created**: [DATE]
   **Status**: Investigating
   **Input**: "$ARGUMENTS"

   ## Description
   [summary]

   ## Expected Behavior
   [expected]

   ## Actual Behavior
   [actual, with error messages if available]

   ## Steps to Reproduce
   1. [Step 1]

   ## Frequency
   [always / intermittent / specific conditions]

   ## Environment
   - **OS**: [e.g., Ubuntu 22.04]
   - **Language/Runtime**: [e.g., Node.js 20.x]
   - **Key Dependencies**: [e.g., React 18.2]

   ## Since When
   [onset timing, relation to recent changes]

   ## Reproduction Results
   **Status**: [Not Attempted / Reproduced / Could Not Reproduce]
   ```

   Fill what can be extracted from `$ARGUMENTS`. Leave unknowns as placeholders.
3. Report "Classified as bugfix: <summary>". Next: `/poor-dev.bugfix`

**4C Roadmap**: Report "Classified as roadmap: <summary>". Next: `/poor-dev.concept`

**4D Q&A**: Report "Classified as Q&A: <summary>". Next: `/poor-dev.ask`

**4E Documentation**: Report "Classified as documentation: <summary>". Next: `/poor-dev.report`

**4F Discovery**: Report "Classified as discovery: <summary>". Next: `/poor-dev.discovery`
Discovery handles its own branch/directory creation.

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
