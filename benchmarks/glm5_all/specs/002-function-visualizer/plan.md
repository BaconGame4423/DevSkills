# Implementation Plan: Function Visualizer with Calculus

**Branch**: `002-function-visualizer` | **Date**: 2026-02-14 | **Spec**: spec.md
**Input**: Feature specification from specs/002-function-visualizer/spec.md

## Summary

Build an interactive function graphing tool with real-time calculus visualization. Users input mathematical expressions, view graphs instantly, and explore derivatives, tangent lines, and point values via cursor interaction. Technical approach: math.js for expression parsing and symbolic differentiation, function-plot (D3.js-based) for high-performance graph rendering with built-in tangent line support.

## Technical Context

**Language/Version**: JavaScript (ES6+)
**Primary Dependencies**: math.js ^11.x, function-plot ^1.x, D3.js ^7.x
**Storage**: None (client-side only)
**Testing**: Vitest (unit) + Playwright (e2e)
**Target Platform**: Web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
**Project Type**: Single page web application
**Performance Goals**: Graph render <500ms, tooltip <50ms, derivative <200ms
**Constraints**: Client-side only, no backend required, must work offline, desktop browsers primary (touch support optional)
**Scale/Scope**: Single-user educational tool

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. AI優先開発 | PASS | Using AI-assisted development for code generation |
| II. スキルベースアーキテクチャ | PASS | Modular component design (InputHandler, GraphRenderer, etc.) |
| III. レビュー主導品質 | PENDING | Adversarial review planned before merge |
| IV. 重要パスのテストファースト | PASS | Critical path: expression parsing → graph rendering (TDD) |
| V. 段階的配信とMVP重視 | PASS | P1 stories (graphing + derivative) form MVP |
| VI. スワーム調整 | N/A | Single-developer feature |
| VII. 可観測性とデバッグ性 | PASS | Structured error messages with actionable guidance |
| VIII. 検証ゲート | PASS | Type-check + lint + test gates defined |
| IX. メモリと知識管理 | N/A | No Hivemind integration for this feature |
| X. セキュリティとプライバシー | PASS | No user data stored, client-side only |

## Project Structure

### Documentation (this feature)

```text
specs/002-function-visualizer/
├── plan.md              # This file
├── spec.md              # Feature specification
├── suggestions.yaml     # Research suggestions
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── tasks.md             # /poor-dev.tasks output
├── suggestion-decisions.yaml
├── exploration-session.yaml
└── checklists/
```

### Source Code (repository root)

```text
src/
├── index.html           # Main HTML entry point
├── styles/
│   └── main.css         # Responsive styles
├── js/
│   ├── main.js          # Application entry point
│   ├── input/
│   │   ├── InputHandler.js      # Expression input with debounce
│   │   └── PresetButtons.js     # Preset function buttons
│   ├── graph/
│   │   ├── GraphRenderer.js     # function-plot wrapper
│   │   └── ViewportManager.js   # Auto-zoom/scale logic
│   ├── calculus/
│   │   ├── ExpressionParser.js  # math.js expression parsing
│   │   ├── DerivativeCalculator.js  # Symbolic differentiation
│   │   └── TangentLine.js       # Tangent line computation
│   ├── ui/
│   │   ├── TooltipManager.js    # Cursor-following tooltip
│   │   └── ErrorHandler.js      # User-friendly error display
│   └── utils/
│       └── debounce.js          # Debounce utility
├── tests/
│   ├── unit/
│   │   ├── ExpressionParser.test.js
│   │   ├── DerivativeCalculator.test.js
│   │   └── InputHandler.test.js
│   └── e2e/
│       └── graph-interaction.spec.js
└── package.json
```

## Architecture

### Component Overview

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `InputHandler` | Expression input, debounce (300ms), validation trigger | debounce.js |
| `ExpressionParser` | Parse string → math.js AST, compile to evaluatable function | math.js |
| `DerivativeCalculator` | Symbolic differentiation using math.derivative() | math.js |
| `GraphRenderer` | Render f(x) and f'(x) using function-plot | function-plot, D3.js |
| `ViewportManager` | Auto-scale x/y range to fit graph | GraphRenderer |
| `TooltipManager` | Cursor-following tooltip (x, f(x), f'(x)) | GraphRenderer, D3.js |
| `TangentLine` | Compute and render tangent at cursor | DerivativeCalculator |
| `PresetButtons` | Quick-insert common functions | InputHandler |
| `ErrorHandler` | Display parse/eval errors with recovery hints | - |

### Data Flow

```text
User Input (expression string)
        ↓
    InputHandler (debounced)
        ↓
    ExpressionParser → AST + compiled function
        ↓           ↓
    [error?]   DerivativeCalculator
        ↓           ↓
    ErrorHandler   derivative AST + compiled function
        ↓           ↓
    [display]   GraphRenderer.render(f, f')
                    ↓
              ViewportManager.autoScale()
                    ↓
              TooltipManager.attach()
                    ↓
              TangentLine.attach()
```

### Key Interfaces

```typescript
interface ParsedExpression {
  ast: math.MathNode;
  fn: (x: number) => number;
  derivative?: ParsedExpression;
  expression: string;
}

interface GraphConfig {
  expression: string;
  showDerivative: boolean;
  showTangent: boolean;
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
}

interface TooltipData {
  x: number;
  fx: number;
  dfx: number | null;
}

interface GraphRenderer {
  render(config: GraphConfig): void;
  onHover(callback: (data: TooltipData) => void): void;
  setViewport(viewport: Viewport): void;
}
```

## Implementation Phases

### Phase 1: Core Graphing (P1 - MVP)

**Goal**: Users can input functions and see graphs in real-time.

- [P1-1] Project setup (HTML skeleton, CSS grid layout, module bundler config)
- [P1-2] `ExpressionParser`: Parse expression string with math.js, compile to function
- [P1-3] `InputHandler`: Text input with 300ms debounce, trigger graph update
- [P1-4] `GraphRenderer`: Basic function-plot integration, render single function
- [P1-5] `ViewportManager`: Auto-scale based on function range
- [P1-6] `PresetButtons`: 7 preset buttons (sin, cos, tan, log, exp, sqrt, abs)
- [P1-7] Axis labels and grid lines (function-plot built-in)
- [P1-8] `ErrorHandler`: Display math.js parse errors with user-friendly messages

**Verification**: User Story 1 acceptance criteria pass.

### Phase 2: Calculus Features (P1 - MVP)

**Goal**: Users can view derivatives and explore tangent lines.

- [P2-1] `DerivativeCalculator`: math.derivative() integration
- [P2-2] Derivative graph overlay (toggle on/off)
- [P2-3] `TangentLine`: Compute tangent line at cursor position
- [P2-4] Tangent line display toggle

**Verification**: User Story 2 acceptance criteria pass.

### Phase 3: UX Enhancements (P2 - Extended)

**Goal**: Interactive analysis and polish.

- [P3-1] `TooltipManager`: Cursor-following tooltip showing x, f(x), f'(x)
- [P3-2] Improved auto-zoom for various function types (polynomial, trig, exp)
- [P3-3] Responsive design (CSS media queries, flexible container)
- [P3-4] Edge case handling: undefined points (1/x at x=0), complex results
- [P3-5] Error recovery: auto-clear errors on valid input

**Verification**: User Story 3, 4, 5 acceptance criteria pass.

### Phase 4: Quality & Testing (P3)

**Goal**: Robust, maintainable codebase.

- [P4-1] Unit tests: ExpressionParser, DerivativeCalculator, InputHandler
- [P4-2] E2E tests: Playwright for graph interaction scenarios
- [P4-3] Performance validation: benchmark graph render <500ms
- [P4-4] Cross-browser testing (Chrome, Firefox, Safari, Edge)

## Parallel Boundaries (並列実装の基盤)

| Phase | Parallelizable Tasks | Dependencies |
|-------|---------------------|--------------|
| P1 | P1-6 (PresetButtons) independent of P1-2 to P1-5 | None |
| P1 | P1-7 (Grid lines) independent - function-plot built-in | None |
| P2 | P2-3 (TangentLine) can start after P2-1 | P2-1 |
| P3 | P3-1, P3-2, P3-3, P3-4 all independent after Phase 2 | Phase 2 complete |

**Recommended parallel execution**:
1. Sprint 1: P1-1 → [P1-2, P1-6 parallel] → P1-3 → P1-4 → P1-5 → P1-7 → P1-8
2. Sprint 2: P2-1 → [P2-2, P2-3 parallel] → P2-4
3. Sprint 3: [P3-1, P3-2, P3-3, P3-4, P3-5 parallel]

## Success Criteria Mapping

| Criterion | Implementation | Verification |
|-----------|---------------|--------------|
| SC-001: Graph <500ms | Debounced input (300ms) + function-plot optimization | Performance test |
| SC-002: Derivative <200ms | math.derivative() + compiled function caching | Performance test |
| SC-003: Tooltip <50ms | requestAnimationFrame + lightweight DOM updates | Performance test |
| SC-004: Responsive 320-1920px | CSS Grid + media queries + flexible container | E2E visual tests |
| SC-005: 100% error handling | try-catch in ExpressionParser + ErrorHandler | Unit tests |
| SC-006: Presets work | PresetButtons component with hardcoded configs | E2E click tests |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| math.js parse failures on edge cases | Comprehensive error messages with examples |
| function-plot performance on complex functions | Sampling optimization, viewport limits |
| Cross-browser D3.js rendering differences | Feature detection, graceful degradation |
| Touch device interaction | Consider pointer events for mobile |

## Dependencies

```json
{
  "dependencies": {
    "mathjs": "^11.11.0",
    "function-plot": "^1.35.0",
    "d3": "^7.8.5"
  },
  "devDependencies": {
    "vitest": "^1.2.0",
    "playwright": "^1.41.0",
    "esbuild": "^0.20.0"
  }
}
```
