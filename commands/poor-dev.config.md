---
description: Hybrid model configuration — manage CLI/model settings per category or agent
---

## User Input

```text
$ARGUMENTS
```

## Config File

Path: `.poor-dev/config.json` (project-root, survives `npx poor-dev update`)

### Default Config (used by `reset`)

```json
{
  "default": {
    "cli": "opencode",
    "model": "zai-coding-plan/glm-4.7"
  },
  "overrides": {
    "fixer": { "cli": "claude", "model": "sonnet" },
    "phasereview": { "cli": "claude", "model": "haiku" }
  },
  "tiers": {
    "T1": { "cli": "claude", "model": "sonnet" },
    "T2": { "cli": "opencode", "model": "minimax-m2.5" },
    "T3": { "cli": "opencode", "model": "minimax-m2.5-lightning" }
  },
  "step_tiers": {
    "specify": "T2",
    "suggest": "T3",
    "plan": "T1",
    "planreview": "T2",
    "tasks": "T2",
    "tasksreview": "T2",
    "implement": "T2",
    "architecturereview": "T2",
    "qualityreview": "T2",
    "phasereview": "T2"
  },
  "review_depth": "auto",
  "speculation": {
    "enabled": true,
    "pairs": { "specify": "suggest" }
  },
  "parallel": {
    "enabled": true,
    "strategy": "auto",
    "max_concurrent": 3
  }
}
```

### Valid Keys

Categories: `planreview`, `tasksreview`, `architecturereview`, `qualityreview`, `phasereview`, `fixer`

Agents: `planreview-pm`, `planreview-risk`, `planreview-value`, `planreview-critical`, `tasksreview-techlead`, `tasksreview-senior`, `tasksreview-devops`, `tasksreview-junior`, `architecturereview-architect`, `architecturereview-security`, `architecturereview-performance`, `architecturereview-sre`, `qualityreview-qa`, `qualityreview-testdesign`, `qualityreview-code`, `qualityreview-security`, `phasereview-qa`, `phasereview-regression`, `phasereview-docs`, `phasereview-ux`, `review-fixer`

Steps (for `step_tiers`): `specify`, `suggest`, `plan`, `planreview`, `tasks`, `tasksreview`, `implement`, `architecturereview`, `qualityreview`, `phasereview`

Tier names: `T1`, `T2`, `T3` (or custom names defined in `tiers`)

CLIs: `claude`, `opencode`

Claude models (fixed): `haiku`, `sonnet`, `opus`

OpenCode models: dynamic — run `opencode models 2>/dev/null` to list.

### Model Resolution Order

When dispatching a step, models are resolved in this priority:
1. `overrides.<agent>` (e.g., `overrides.planreview-pm`)
2. `overrides.<category>` (e.g., `overrides.planreview`)
3. `step_tiers.<step>` → `tiers[tier]` (e.g., `step_tiers.plan` → `T1` → `tiers.T1`)
4. `default`
5. Hardcoded fallback: `{ "cli": "claude", "model": "sonnet" }`

Error handling:
- Unknown tier name in `step_tiers` → WARNING + fallback to `default`
- Tier model unavailable → `fallback_model` → FALLBACK_MODE (Task subagent)

### Review Depth

`review_depth` controls how many personas and iterations run per review:

| Value | Personas | Max Iterations | When |
|-------|----------|----------------|------|
| `"deep"` | 4 | 10 | Large/risky changes |
| `"standard"` | 4 | 5 | Medium changes |
| `"light"` | 2 (most important) | 3 | Small/safe changes |
| `"auto"` | Computed from change metrics | — | Default |

Auto scoring: `lines_changed` + `files_changed` + `auth/crypto` + `new_deps` → deep/standard/light.

---

## Subcommand Routing

Parse `$ARGUMENTS` and execute the matching subcommand:

| Pattern | Action |
|---------|--------|
| `show` or empty | → Show |
| `default <cli> <model>` | → Set Default |
| `set <key> <cli> <model>` | → Set Override |
| `unset <key>` | → Unset Override |
| `tier <name> <cli> <model>` | → Set Tier |
| `tier-unset <name>` | → Remove Tier |
| `step-tier <step> <tier>` | → Set Step Tier |
| `step-tier-unset <step>` | → Remove Step Tier |
| `depth <auto\|deep\|standard\|light>` | → Set Review Depth |
| `speculation <on\|off>` | → Toggle Speculation |
| `parallel <on\|off\|auto\|same-branch\|worktree\|phase-split>` | → Set Parallel Strategy |
| `reset` | → Reset to Default Config |
| anything else | → Show help with valid syntax |

---

## Subcommand: `show`

1. Run Bash: `cat .poor-dev/config.json 2>/dev/null`
   - If file missing → auto-create with default config (see above), then read again.
2. Run Bash: `opencode models 2>/dev/null` (skip if opencode not installed)
3. Format output as table:

```
Default: <cli> / <model>

Tiers:
  T1: claude / sonnet
  T2: opencode / minimax-m2.5
  T3: opencode / minimax-m2.5-lightning

Step         Tier  CLI        Model                    Source
---------------------------------------------------------------
specify      T2    opencode   minimax-m2.5             (step_tier)
suggest      T3    opencode   minimax-m2.5-lightning   (step_tier)
plan         T1    claude     sonnet                   (step_tier)
planreview   T2    opencode   minimax-m2.5             (step_tier)
...
fixer        —     claude     sonnet                   (override)

Review depth: auto
Speculation: enabled (specify → suggest)
Parallel: enabled (strategy: auto, max: 3)

Available models (OpenCode):
  <output from opencode models>

Available models (Claude Code):
  haiku, sonnet, opus
```

Show resolution: for each step/category, resolve using priority chain: overrides → step_tiers → default.

---

## Subcommand: `default <cli> <model>`

1. Validate `<cli>` is `claude` or `opencode`. Error + show valid values if not.
2. Validate `<model>`:
   - If cli=claude: must be `haiku`, `sonnet`, or `opus`.
   - If cli=opencode: run `opencode models 2>/dev/null` and check presence. If opencode not installed, accept any value with warning.
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Update `default.cli` and `default.model`.
5. Write back. Show confirmation.

---

## Subcommand: `set <key> <cli> <model>`

1. Validate `<key>` is a valid category or agent name (see Valid Keys above). Error + show valid keys if not.
2. Validate `<cli>` and `<model>` (same as `default`).
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Set `overrides.<key>` = `{ "cli": "<cli>", "model": "<model>" }`.
5. Write back. Show confirmation.

---

## Subcommand: `unset <key>`

1. Validate `<key>` exists in `overrides`. Error if not found.
2. Read `.poor-dev/config.json`.
3. Remove `overrides.<key>`.
4. Write back. Show confirmation + what the key now resolves to (default).

---

## Subcommand: `tier <name> <cli> <model>`

1. Validate `<name>` is a valid tier name (e.g., `T1`, `T2`, `T3`, or custom).
2. Validate `<cli>` and `<model>` (same as `default`).
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Set `tiers.<name>` = `{ "cli": "<cli>", "model": "<model>" }`.
5. Write back. Show confirmation + which steps use this tier.

---

## Subcommand: `tier-unset <name>`

1. Validate `<name>` exists in `tiers`. Error if not found.
2. Read `.poor-dev/config.json`.
3. Remove `tiers.<name>`.
4. Write back. Show confirmation + warn if any `step_tiers` reference this tier.

---

## Subcommand: `step-tier <step> <tier>`

1. Validate `<step>` is a valid step name (see Valid Keys → Steps). Error if not.
2. Validate `<tier>` exists in `tiers`. Error if not (show available tiers).
3. Read `.poor-dev/config.json` (create with defaults if missing).
4. Set `step_tiers.<step>` = `"<tier>"`.
5. Write back. Show confirmation + resolved cli/model.

---

## Subcommand: `step-tier-unset <step>`

1. Validate `<step>` exists in `step_tiers`. Error if not found.
2. Read `.poor-dev/config.json`.
3. Remove `step_tiers.<step>`.
4. Write back. Show confirmation + what the step now resolves to.

---

## Subcommand: `depth <auto|deep|standard|light>`

1. Validate value is one of: `auto`, `deep`, `standard`, `light`.
2. Read `.poor-dev/config.json` (create with defaults if missing).
3. Set `review_depth` = `"<value>"`.
4. Write back. Show confirmation.

---

## Subcommand: `speculation <on|off>`

1. Read `.poor-dev/config.json` (create with defaults if missing).
2. Set `speculation.enabled` = `true` (on) or `false` (off).
3. Write back. Show confirmation + current pairs if enabled.

---

## Subcommand: `parallel <on|off|auto|same-branch|worktree|phase-split>`

1. Read `.poor-dev/config.json` (create with defaults if missing).
2. If `on` → set `parallel.enabled` = true, `parallel.strategy` = "auto".
3. If `off` → set `parallel.enabled` = false.
4. If `auto|same-branch|worktree|phase-split` → set `parallel.enabled` = true, `parallel.strategy` = value.
5. Write back. Show confirmation.

---

## Subcommand: `reset`

1. `mkdir -p .poor-dev`
2. Write default config (see Default Config above) to `.poor-dev/config.json`.
3. Show confirmation + run `show` to display result.

---

## Error Handling

| Error | Response |
|-------|----------|
| Invalid CLI name | Error message + show `claude`, `opencode` |
| Invalid model | Error message + list available models for the specified CLI |
| Invalid key | Error message + list all valid category/agent keys |
| Bad syntax / no args | Show help with all valid subcommand patterns |
| Config file missing | Auto-create with default config |
| `opencode` not installed | Warning + skip OpenCode model validation (accept any value) |
| `claude` not installed | Warning + skip Claude model validation (accept any value) |

---

## Implementation Notes

- All operations use Bash to read/write `.poor-dev/config.json`. Use `jq` if available, otherwise manipulate JSON directly as LLM.
- `mkdir -p .poor-dev` before any write.
- Config file is plain JSON — no comments, no trailing commas.
