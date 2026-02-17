# Task Breakdown: 関数ビジュアライザー（微分機能付き）

**Branch**: `002-fr001-fr002-fr003-fr004`
**Created**: 2026-02-17

---

## Phase 0 - Project Infrastructure

### T001: Initialize Project
- **Phase**: 0
- **Description**: Create Vite + TypeScript project with vanilla-ts template
- **Files**: package.json, index.html, src/main.ts
- **Deps**: none
- **Est**: 30m
- **Acceptance**:
  - `npm run dev` starts development server
  - TypeScript compiles without errors
  - Basic HTML renders in browser
  - package.json includes npm scripts: dev, build, typecheck, lint, test, test:e2e

### T002: Install Core Dependencies
- **Phase**: 0
- **Description**: Install function-plot, math.js, d3, lodash.debounce
- **Files**: package.json
- **Deps**: T001
- **Est**: 15m
- **Acceptance**:
  - All dependencies in package.json
  - `npm install` succeeds without warnings
  - Versions: function-plot@1.25.3, mathjs@15.1.1, d3@7.9.0, lodash.debounce@4.17.21
- **[P]**: Parallel with T003, T004

### T003: Configure TypeScript
- **Phase**: 0
- **Description**: Setup tsconfig.json with strict mode and path aliases
- **Files**: tsconfig.json, tsconfig.node.json
- **Deps**: T001
- **Est**: 15m
- **Acceptance**:
  - `strict: true` enabled
  - Path alias `@/*` maps to `./src/*`
  - `npm run typecheck` passes
- **[P]**: Parallel with T002, T004

### T004: Configure Vite Build
- **Phase**: 0
- **Description**: Setup vite.config.ts with aliases and optimization
- **Files**: vite.config.ts
- **Deps**: T001
- **Est**: 15m
- **Acceptance**:
  - Resolve alias configured for `@/`
  - Build output goes to `dist/`
  - `npm run build` succeeds
- **[P]**: Parallel with T002, T003

### T005: Create Project Structure
- **Phase**: 0
- **Description**: Create directory structure for components, services, models, styles, tests
- **Files**: src/components/, src/services/, src/models/, src/styles/, tests/unit/, tests/e2e/
- **Deps**: T001
- **Est**: 10m
- **Acceptance**:
  - All directories created
  - .gitkeep files in empty directories

### T006: Setup Linting and Formatting
- **Phase**: 0
- **Description**: Configure ESLint and Prettier for TypeScript
- **Files**: .eslintrc.json, .prettierrc
- **Deps**: T003
- **Est**: 15m
- **Acceptance**:
  - `npm run lint` command works
  - Prettier formats TypeScript files

---

## Phase 1 - Core Models & Contracts

### T007: Define FunctionExpression Model
- **Phase**: 1
- **Description**: Create FunctionExpression interface per data-model.md
- **Files**: src/models/FunctionExpression.ts
- **Deps**: T005
- **Est**: 30m
- **Acceptance**:
  - Interface matches data-model.md spec
  - Fields: id, raw, normalized, isValid, error
- **[P]**: Parallel with T008, T009, T010, T011

### T008: Define Derivative Model
- **Phase**: 1
- **Description**: Create Derivative interface per data-model.md
- **Files**: src/models/Derivative.ts
- **Deps**: T005
- **Est**: 20m
- **Acceptance**:
  - Interface matches data-model.md spec
  - Fields: sourceId, expression, isValid, error
- **[P]**: Parallel with T007, T009, T010, T011

### T009: Define GraphState Model
- **Phase**: 1
- **Description**: Create GraphState interface with domain, zoom, display options
- **Files**: src/models/GraphState.ts
- **Deps**: T005
- **Est**: 30m
- **Acceptance**:
  - Interface matches data-model.md spec
  - Includes defaultGraphState constant
  - Domain type: { x: [number, number], y: [number, number] }
- **[P]**: Parallel with T007, T008, T010, T011

### T010: Define TooltipData Model
- **Phase**: 1
- **Description**: Create TooltipData interface for cursor tracking
- **Files**: src/models/TooltipData.ts
- **Deps**: T005
- **Est**: 15m
- **Acceptance**:
  - Interface matches data-model.md spec
  - Fields: x, fx, fpx, visible
- **[P]**: Parallel with T007, T008, T009, T011

### T011: Define PresetFunction Model
- **Phase**: 1
- **Description**: Create PresetFunction interface and presets array
- **Files**: src/models/PresetFunction.ts
- **Deps**: T005
- **Est**: 20m
- **Acceptance**:
  - Interface matches data-model.md spec
  - Presets array includes sin, cos, tan, x^2, x^3, log, exp, sqrt, abs
- **[P]**: Parallel with T007, T008, T009, T010

### T012: Export Models Index
- **Phase**: 1
- **Description**: Create models/index.ts with all model exports
- **Files**: src/models/index.ts
- **Deps**: T007, T008, T009, T010, T011
- **Est**: 10m
- **Acceptance**:
  - All models exported from single entry point
  - `import { ... } from '@/models'` works

### T013: Create AppState Foundation
- **Phase**: 1
- **Description**: Implement AppState class with reactive event emitters
- **Files**: src/services/AppState.ts
- **Deps**: T012
- **Est**: 1h
- **Acceptance**:
  - Manages expressions, derivative, graphState, tooltipData
  - Event emitters for each state change
  - Getter/setter methods for state updates
- **Note**: Use EventTarget API or simple callback pattern for reactive emitters

---

## Phase 2 - Math Services (FR-006, FR-007)

### T014: Create ExpressionParser Service
- **Phase**: 2
- **Description**: Implement expression parsing using math.js
- **Files**: src/services/ExpressionParser.ts
- **Deps**: T007, T012
- **Est**: 1h
- **Acceptance**:
  - Parses expressions: x^2, sin(x), 2*x+1
  - Normalizes input for math.js
  - Catches and reports SyntaxError
- **[P]**: Parallel with T015, T016

### T015: Create DerivativeService
- **Phase**: 2
- **Description**: Implement derivative calculation using math.derivative()
- **Files**: src/services/DerivativeService.ts
- **Deps**: T008, T012
- **Est**: 1.5h
- **Acceptance**:
  - Calculates symbolic derivative for supported functions
  - Returns Derivative model with expression string
  - Handles calculation errors gracefully
- **[P]**: Parallel with T014, T016

### T016: Create ExpressionValidator
- **Phase**: 2
- **Description**: Implement input validation with whitelist pattern
- **Files**: src/services/ExpressionValidator.ts
- **Deps**: T007, T012
- **Est**: 45m
- **Acceptance**:
  - Validates allowed characters and functions per research.md
  - Blocks alert(), eval(), SQL patterns
  - Returns validation result with error message
  - Handles empty input gracefully (returns invalid with appropriate message)
- **[P]**: Parallel with T014, T015

### T017: Add Derivative Caching
- **Phase**: 2
- **Description**: Implement memoization for derivative calculations
- **Files**: src/services/DerivativeService.ts
- **Deps**: T015
- **Est**: 30m
- **Acceptance**:
  - Cache key is expression string
  - Repeated calculations return cached result
  - Cache invalidates on new expression

### T018: Create Math Services Unit Tests
- **Phase**: 2
- **Description**: Write Vitest tests for all math services
- **Files**: tests/unit/ExpressionParser.test.ts, tests/unit/DerivativeService.test.ts, tests/unit/ExpressionValidator.test.ts
- **Deps**: T014, T015, T016, T017
- **Est**: 1.5h
- **Acceptance**:
  - Tests cover all public methods
  - Edge cases: invalid syntax, division by zero
  - Tests cover caching behavior (from T017)
  - `npm run test` passes
- **[P]**: Parallel with Phase 3 tasks

---

## Phase 3 - Graph Components (FR-001, FR-004, FR-005) - US1

### T019: Create GraphCanvas Component
- **Phase**: 3
- **Description**: Create main graph container component with function-plot integration
- **Files**: src/components/GraphCanvas.ts
- **Deps**: T013, T009
- **Est**: 2h
- **Acceptance**:
  - Renders 2D coordinate plane
  - Container has explicit height (400px default)
  - Responsive width (100%)
- **[P]**: Parallel with T023

### T020: Implement Graph Rendering
- **Phase**: 3
- **Description**: Integrate function-plot for function visualization
- **Files**: src/components/GraphCanvas.ts
- **Deps**: T019
- **Est**: 2h
- **Acceptance**:
  - Single function renders correctly (x^2 shows parabola)
  - Graph updates when expression changes
  - Render time < 1s (SC-001)

### T021: Add Axis Labels and Grid
- **Phase**: 3
- **Description**: Configure axis labels and grid lines via function-plot
- **Files**: src/components/GraphCanvas.ts
- **Deps**: T020
- **Est**: 30m
- **Acceptance**:
  - X-axis and Y-axis labels visible
  - Grid lines displayed
  - Toggle-able via GraphState.showGrid

### T022: Implement Auto-Zoom/Scale
- **Phase**: 3
- **Description**: Auto-adjust domain to fit visible function portion
- **Files**: src/services/GraphService.ts
- **Deps**: T009, T023
- **Est**: 1h
- **Acceptance**:
  - Domain auto-adjusts for function range
  - Handles extreme values gracefully
  - User can override with manual zoom

### T023: Create GraphService
- **Phase**: 3
- **Description**: Service to manage graph configuration and updates
- **Files**: src/services/GraphService.ts
- **Deps**: T009, T013
- **Est**: 1h
- **Acceptance**:
  - Manages function-plot instance
  - Handles domain updates
  - Coordinates with AppState
- **[P]**: Parallel with T019

### T024: Add Graph Component Tests
- **Phase**: 3
- **Description**: Write integration tests for graph rendering
- **Files**: tests/integration/graph-rendering.test.ts
- **Deps**: T020, T021
- **Est**: 1h
- **Acceptance**:
  - Tests verify SVG output
  - Tests verify grid/axis visibility
  - `npm run test` passes

---

## Phase 4 - Input Components (FR-002, FR-003, FR-012, FR-013) - US1

### T025: Create FunctionInput Component
- **Phase**: 4
- **Description**: Create text input for mathematical expressions
- **Files**: src/components/FunctionInput.ts
- **Deps**: T013, T014, T016
- **Est**: 1.5h
- **Acceptance**:
  - Input field accepts expression text
  - Validates on input change
  - Displays error state for invalid input
- **[P]**: Parallel with T027, T028

### T026: Implement Debounced Input
- **Phase**: 4
- **Description**: Add 300ms debounce for real-time graph updates
- **Files**: src/components/FunctionInput.ts
- **Deps**: T025
- **Est**: 30m
- **Acceptance**:
  - Graph updates after 300ms debounce
  - Update latency < 100ms after typing stops (SC-002)
  - Uses lodash.debounce

### T027: Create PresetButtons Component
- **Phase**: 4
- **Description**: Create preset function buttons per FR-013
- **Files**: src/components/PresetButtons.ts
- **Deps**: T011, T013
- **Est**: 1h
- **Acceptance**:
  - Buttons for sin, cos, x^2, x^3, log, exp
  - Click populates input field
  - Touch-friendly size (min 44px)
- **[P]**: Parallel with T025, T028

### T028: Create ErrorMessage Component
- **Phase**: 4
- **Description**: Create error display component for invalid input (FR-012)
- **Files**: src/components/ErrorMessage.ts
- **Deps**: T007, T013
- **Est**: 30m
- **Acceptance**:
  - Displays parse error messages
  - Red border on invalid input
  - User-friendly Japanese messages
- **[P]**: Parallel with T025, T027

### T029: Add Input Component Tests
- **Phase**: 4
- **Description**: Write unit tests for input components
- **Files**: tests/unit/FunctionInput.test.ts, tests/unit/PresetButtons.test.ts
- **Deps**: T025, T026, T027
- **Est**: 1h
- **Acceptance**:
  - Tests cover debounce behavior
  - Tests cover preset button clicks
  - Tests cover error display

---

## Phase 5 - Derivative & Tooltip (FR-007, FR-008, FR-009) - US2

### T030: Add Derivative Toggle UI
- **Phase**: 5
- **Description**: Create checkbox/toggle to show/hide derivative
- **Files**: src/components/DerivativeToggle.ts
- **Deps**: T013, T009
- **Est**: 30m
- **Acceptance**:
  - Toggle controls GraphState.showDerivative
  - Clear visual state (on/off)

### T031: Implement Derivative Graph Overlay
- **Phase**: 5
- **Description**: Overlay derivative graph with distinct color (FR-008)
- **Files**: src/components/GraphCanvas.ts
- **Deps**: T020, T015, T030
- **Est**: 1h
- **Acceptance**:
  - Derivative renders in different color
  - Toggle visibility works
  - Calculation completes < 500ms (SC-003)

### T032: Create TooltipOverlay Component
- **Phase**: 5
- **Description**: Create cursor-following tooltip for coordinate display
- **Files**: src/components/TooltipOverlay.ts
- **Deps**: T010, T013
- **Est**: 1h
- **Acceptance**:
  - Tooltip follows cursor on graph
  - Positioned relative to cursor
  - Hidden when cursor leaves graph

### T033: Implement Cursor Tracking
- **Phase**: 5
- **Description**: Track cursor position and update tooltip (FR-009)
- **Files**: src/components/TooltipOverlay.ts
- **Deps**: T032
- **Est**: 1h
- **Acceptance**:
  - Uses requestAnimationFrame for updates
  - Updates at 30fps minimum (SC-006)
  - Smooth cursor following

### T034: Add Tooltip Data Display
- **Phase**: 5
- **Description**: Display x, f(x), f'(x) values in tooltip
- **Files**: src/components/TooltipOverlay.ts
- **Deps**: T033, T015
- **Est**: 45m
- **Acceptance**:
  - Shows x-coordinate at cursor position
  - Shows f(x) value
  - Shows f'(x) value when derivative enabled

### T035: Add Derivative Feature Tests
- **Phase**: 5
- **Description**: Write integration tests for derivative features
- **Files**: tests/integration/derivative.test.ts
- **Deps**: T031, T034
- **Est**: 1h
- **Acceptance**:
  - Tests verify derivative calculation
  - Tests verify overlay rendering
  - Tests verify tooltip values

---

## Phase 6 - Tangent Line (FR-010) - US3

### T036: Create TangentLine Component
- **Phase**: 6
- **Description**: Create tangent line visualization component
- **Files**: src/components/TangentLine.ts
- **Deps**: T013, T009
- **Est**: 1h
- **Acceptance**:
  - Component ready for tangent rendering
  - Toggle for tangent mode

### T037: Implement Tangent Line Calculation
- **Phase**: 6
- **Description**: Calculate tangent line equation at point x=a
- **Files**: src/services/TangentService.ts
- **Deps**: T015, T008
- **Est**: 1h
- **Acceptance**:
  - Calculates y = f'(a)(x-a) + f(a)
  - Returns line endpoints for rendering

### T038: Add Click-to-Select Point
- **Phase**: 6
- **Description**: Allow user to click graph to set tangent point
- **Files**: src/components/GraphCanvas.ts
- **Deps**: T036, T037
- **Est**: 1h
- **Acceptance**:
  - Click event captures x-coordinate
  - Updates GraphState.tangentLine.x
  - Visual marker at selected point

### T039: Update Tangent on Cursor Move
- **Phase**: 6
- **Description**: Dynamically update tangent line as cursor moves
- **Files**: src/components/TangentLine.ts
- **Deps**: T038, T037
- **Est**: 1h
- **Acceptance**:
  - Tangent updates in real-time
  - Smooth animation on move
  - Shows slope = f'(x) at point

### T040: Add Tangent Line Tests
- **Phase**: 6
- **Description**: Write tests for tangent line functionality
- **Files**: tests/unit/TangentService.test.ts, tests/integration/tangent.test.ts
- **Deps**: T037, T039
- **Est**: 1h
- **Acceptance**:
  - Tests verify tangent calculation
  - Tests verify click interaction
  - Tests verify dynamic updates

---

## Phase 7 - Multi-function Support (FR-006, FR-001) - US4

### T041: Extend AppState for Multiple Functions
- **Phase**: 7
- **Description**: Update AppState to manage multiple function expressions
- **Files**: src/services/AppState.ts
- **Deps**: T013
- **Est**: 1.5h
- **Acceptance**:
  - expressions: FunctionExpression[] supports multiple entries
  - Add/remove/update functions
  - Each function has unique id

### T042: Create FunctionList Component
- **Phase**: 7
- **Description**: Component to display and manage multiple functions
- **Files**: src/components/FunctionList.ts
- **Deps**: T041
- **Est**: 1.5h
- **Acceptance**:
  - Shows list of active functions
  - Add new function button
  - Remove function button per item

### T043: Implement Legend Display
- **Phase**: 7
- **Description**: Show legend with function names and colors
- **Files**: src/components/Legend.ts
- **Deps**: T041, T020
- **Est**: 1h
- **Acceptance**:
  - Legend shows all functions
  - Color matches graph line
  - Toggle visibility per function

### T044: Add Function Color Assignment
- **Phase**: 7
- **Description**: Assign distinct colors to each function
- **Files**: src/services/ColorService.ts
- **Deps**: T041
- **Est**: 30m
- **Acceptance**:
  - Automatic color assignment
  - Colors are visually distinct
  - Consistent per function id

### T045: Add Multi-function Tests
- **Phase**: 7
- **Description**: Write tests for multi-function features
- **Files**: tests/integration/multi-function.test.ts
- **Deps**: T041, T042, T043, T044
- **Est**: 1h
- **Acceptance**:
  - Tests verify multiple function rendering
  - Tests verify add/remove functions
  - Tests verify legend functionality

---

## Phase 8 - Mobile & Polish (FR-011) - US5

### T046: Create Responsive CSS Layout
- **Phase**: 8
- **Description**: Implement CSS Grid layout with responsive breakpoints
- **Files**: src/styles/main.css
- **Deps**: T005
- **Est**: 1.5h
- **Acceptance**:
  - CSS Grid for main layout
  - CSS Custom Properties for values
  - Works at 320px-1920px width (SC-004)

### T047: Add Mobile Breakpoints
- **Phase**: 8
- **Description**: Add media queries for mobile viewports
- **Files**: src/styles/main.css
- **Deps**: T046
- **Est**: 1h
- **Acceptance**:
  - Breakpoints at 768px and 480px
  - Graph height adjusts per breakpoint
  - Controls stack vertically on mobile

### T048: Ensure Touch Target Sizes
- **Phase**: 8
- **Description**: Verify all interactive elements are 44px minimum
- **Files**: src/styles/main.css, src/components/*.ts
- **Deps**: T027, T046
- **Est**: 30m
- **Acceptance**:
  - All buttons min 44px × 44px
  - Touch-friendly spacing
  - No overlapping touch targets

### T049: Add Touch Zoom Support
- **Phase**: 8
- **Description**: Enable pinch-to-zoom on mobile (via d3-zoom)
- **Files**: src/services/GraphService.ts
- **Deps**: T023
- **Est**: 30m
- **Acceptance**:
  - Pinch gesture zooms graph
  - Works on touch devices
  - Smooth zoom animation

### T050: Add Mobile Tests
- **Phase**: 8
- **Description**: Write tests for mobile responsiveness
- **Files**: tests/e2e/mobile.test.ts
- **Deps**: T046, T047, T048, T049
- **Est**: 1h
- **Acceptance**:
  - Tests at 320px, 768px, 1024px viewports
  - Tests verify touch interactions
  - Tests verify responsive layout

---

## DevOps & CI/CD

### T051: Configure Build Optimization
- **Phase**: 8
- **Description**: Optimize Vite build for production
- **Files**: vite.config.ts
- **Deps**: T004
- **Est**: 45m
- **Acceptance**:
  - Tree-shaking enabled
  - Minification enabled
  - Source maps for debugging
- **[P]**: Parallel with T052, T053

### T052: Setup Vitest Configuration
- **Phase**: 8
- **Description**: Configure Vitest for unit and integration tests
- **Files**: vitest.config.ts
- **Deps**: T003
- **Est**: 30m
- **Acceptance**:
  - Coverage reporting enabled
  - Alias resolution works
  - `npm run test` runs all tests
- **[P]**: Parallel with T051, T053

### T053: Setup Playwright Configuration
- **Phase**: 8
- **Description**: Configure Playwright for E2E tests
- **Files**: playwright.config.ts
- **Deps**: T004
- **Est**: 30m
- **Acceptance**:
  - Configured for Chromium, Firefox, WebKit
  - Screenshot on failure
  - `npm run test:e2e` works
- **[P]**: Parallel with T051, T052

### T054: Create GitHub Actions CI Workflow
- **Phase**: 8
- **Description**: Setup CI pipeline for testing and building
- **Files**: .github/workflows/ci.yml
- **Deps**: T052, T053
- **Est**: 1h
- **Acceptance**:
  - Runs on push to main/feature branches
  - Runs typecheck, lint, tests
  - Reports test results

### T055: Add Pre-commit Hooks
- **Phase**: 8
- **Description**: Setup husky/lint-staged for pre-commit checks
- **Files**: .husky/pre-commit, package.json
- **Deps**: T006
- **Est**: 30m
- **Acceptance**:
  - Runs lint on staged files
  - Runs typecheck
  - Blocks commit on failure

### T056: Create E2E Tests - US1
- **Phase**: 8
- **Description**: E2E tests for basic function visualization
- **Files**: tests/e2e/us1-basic-visualization.spec.ts
- **Deps**: T053, T020
- **Est**: 1h
- **Acceptance**:
  - Test: Input x^2 shows parabola
  - Test: Change to sin(x) updates graph
  - Test: Axis and grid visible
- **[P]**: Parallel with T057, T058, T059, T060

### T057: Create E2E Tests - US2
- **Phase**: 8
- **Description**: E2E tests for derivative understanding
- **Files**: tests/e2e/us2-derivative.spec.ts
- **Deps**: T053, T031, T034
- **Est**: 1h
- **Acceptance**:
  - Test: Derivative toggle shows overlay
  - Test: Tooltip shows x, f(x), f'(x)
  - Test: Derivative calculation accuracy
- **[P]**: Parallel with T056, T058, T059, T060

### T058: Create E2E Tests - US3
- **Phase**: 8
- **Description**: E2E tests for tangent line visualization
- **Files**: tests/e2e/us3-tangent.spec.ts
- **Deps**: T053, T039
- **Est**: 1h
- **Acceptance**:
  - Test: Click enables tangent mode
  - Test: Tangent line displays correctly
  - Test: Move updates tangent
- **[P]**: Parallel with T056, T057, T059, T060

### T059: Create E2E Tests - US4
- **Phase**: 8
- **Description**: E2E tests for multiple function comparison
- **Files**: tests/e2e/us4-multi-function.spec.ts
- **Deps**: T053, T043
- **Est**: 1h
- **Acceptance**:
  - Test: Add multiple functions
  - Test: Distinct colors for each
  - Test: Legend toggles visibility
- **[P]**: Parallel with T056, T057, T058, T060

### T060: Create E2E Tests - US5
- **Phase**: 8
- **Description**: E2E tests for mobile usability
- **Files**: tests/e2e/us5-mobile.spec.ts
- **Deps**: T053, T049
- **Est**: 1h
- **Acceptance**:
  - Test: Mobile viewport responsive
  - Test: Touch targets accessible
  - Test: Pinch zoom works
- **[P]**: Parallel with T056, T057, T058, T059

### T061: Add Performance Tests
- **Phase**: 8
- **Description**: Create performance benchmark tests
- **Files**: tests/performance/render-perf.test.ts
- **Deps**: T052, T020
- **Est**: 1h
- **Acceptance**:
  - Tests render time < 1s
  - Tests update latency < 100ms
  - Tests tooltip 30fps

### T062: Create Deployment Workflow
- **Phase**: 8
- **Description**: Setup deployment to GitHub Pages or similar
- **Files**: .github/workflows/deploy.yml
- **Deps**: T054
- **Est**: 45m
- **Acceptance**:
  - Deploys on main branch push
  - Builds production assets
  - Deploys to hosting platform

### T063: Add Production Optimization
- **Phase**: 8
- **Description**: Final production optimizations and bundle analysis
- **Files**: vite.config.ts, package.json
- **Deps**: T051
- **Est**: 30m
- **Acceptance**:
  - Bundle size analyzed
  - Compression enabled
  - Cache headers configured

### T064: Create User Documentation
- **Phase**: 8
- **Description**: Write user guide and API documentation
- **Files**: docs/README.md, docs/API.md
- **Deps**: T020, T031, T039
- **Est**: 1h
- **Acceptance**:
  - How to use the visualizer
  - Supported functions listed
  - Screenshots included

### T065: Final Integration Testing
- **Phase**: 8
- **Description**: Complete integration test of all features
- **Files**: tests/e2e/full-integration.spec.ts
- **Deps**: T056, T057, T058, T059, T060
- **Est**: 1h
- **Acceptance**:
  - All user stories testable end-to-end
  - No regressions
  - All tests pass

### T066: Release Preparation
- **Phase**: 8
- **Description**: Final checklist and release preparation
- **Files**: CHANGELOG.md, package.json
- **Deps**: T065, T064, T062
- **Est**: 30m
- **Acceptance**:
  - Version bumped
  - Changelog updated
  - Release notes prepared

---

## Task Dependency Graph

```
Phase 0 (Infrastructure):
T001 ─┬─► T002 ─┐
      ├─► T003 ─┼─► T006
      ├─► T004 ─┤
      └─► T005 ─┘

Phase 1 (Models):
T005 ─┬─► T007 ─┐
      ├─► T008 ─┼─► T012 ─► T013
      ├─► T009 ─┤
      ├─► T010 ─┤
      └─► T011 ─┘

Phase 2 (Math Services):
T012 ─┬─► T014 ─┐
      ├─► T015 ─┼─► T017 ─► T018
      └─► T016 ─┘

Phase 3 (Graph - US1):
T009, T013 ─► T019 ─► T020 ─► T021 ─► T024
                 │
T009, T013 ──────┴─► T023 ─► T022

Phase 4 (Input - US1):
T013, T014, T016 ─► T025 ─► T026 ─► T029
T011, T013 ───────► T027 ─────────┘
T007, T013 ───────► T028 ─────────┘

Phase 5 (Derivative - US2):
T009, T013 ─► T030 ─► T031 ─► T035
T010, T013 ─► T032 ─► T033 ─► T034 ─┘

Phase 6 (Tangent - US3):
T009, T013 ─► T036 ─► T038 ─► T039 ─► T040
T008, T015 ─► T037 ───────────┘

Phase 7 (Multi-function - US4):
T013 ─► T041 ─┬─► T042 ─► T045
              ├─► T043 ────┤
              └─► T044 ────┘

Phase 8 (Mobile - US5):
T005 ─► T046 ─► T047 ─► T050
      │         ├─► T048 ─┘
      └─► T049 ─┘

DevOps (Parallel):
T004 ─► T051 ─► T063
T003 ─► T052 ─► T054 ─► T062 ─► T066
T004 ─► T053 ─► T056-T060 ─► T065 ─┘
T006 ─► T055                   │
                         T064 ─┘
```

---

## Summary

**Branch**: `002-fr001-fr002-fr003-fr004`
**Tasks Path**: `specs/002-fr001-fr002-fr003-fr004/tasks.md`

### Task Statistics

| Metric | Value |
|--------|-------|
| Total Tasks | 66 |
| MVP Tasks (Phase 1-3) | 30 |
| Parallelizable Tasks | 22 |
| Phases | 8 |

### Task Count by User Story

| User Story | Priority | Tasks |
|------------|----------|-------|
| US1 - 基本関数の可視化 | P1 | 11 (T019-T029) |
| US2 - 導関数の理解 | P1 | 6 (T030-T035) |
| US3 - 接線の視覚化 | P2 | 5 (T036-T040) |
| US4 - 複数関数の比較 | P2 | 5 (T041-T045) |
| US5 - モバイルでの利用 | P3 | 5 (T046-T050) |
| Infrastructure | - | 6 (T001-T006) |
| Models | - | 7 (T007-T013) |
| Math Services | - | 5 (T014-T018) |
| DevOps/CI/CD | - | 16 (T051-T066) |

### Parallel Opportunities

- **Phase 0**: T002, T003, T004 (config files)
- **Phase 1**: T007, T008, T009, T010, T011 (models)
- **Phase 2**: T014, T015, T016 (services)
- **Phase 3**: T019, T023 (graph components; T022 follows T023)
- **Phase 4**: T025, T027, T028 (input components)
- **Phase 8**: T051, T052, T053 (tooling config)
- **Phase 8**: T056, T057, T058, T059, T060 (E2E tests)

### Independent Test Criteria

| Story | Test |
|-------|------|
| US1 | Input "x^2" → graph renders < 1s |
| US2 | Input "x^3" → f(x) and f'(x)=3x² displayed |
| US3 | Click at x=1 for f(x)=x² → tangent y=2x-1 shown |
| US4 | sin(x) + cos(x) → both render with distinct colors |
| US5 | Mobile viewport < 768px → touch interactions work |

### Suggested MVP Scope

**Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4 (US1)** = 30 tasks

### Functional Requirements Coverage

| FR | Tasks |
|----|-------|
| FR-001 | T019, T020, T023 |
| FR-002 | T025 |
| FR-003 | T026 |
| FR-004 | T022, T049 |
| FR-005 | T021 |
| FR-006 | T014, T016, T041 |
| FR-007 | T015, T031 |
| FR-008 | T031 |
| FR-009 | T032, T033, T034 |
| FR-010 | T036, T037, T038, T039 |
| FR-011 | T046, T047, T048, T049 |
| FR-012 | T016, T028 |
| FR-013 | T027 |
