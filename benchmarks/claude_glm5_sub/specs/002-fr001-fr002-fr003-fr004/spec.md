
# Feature Specification: 関数ビジュアライザー（微分機能付き）

**Feature Branch**: `002-function-visualizer-diff`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "微分機能付きインタラクティブ数学ツール「関数ビジュアライザー」を開発してください。要件: FR-001: インタラクティブ関数グラフ表示, FR-002: 数式入力フィールド, FR-003: リアルタイムグラフ更新, FR-004: 自動ズーム/スケール, FR-005: 軸ラベルとグリッド線, FR-006: 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs), FR-007: 微分（導関数）の計算と表示, FR-008: 導関数のグラフ重畳表示, FR-009: カーソル追従ツールチップ (x, f(x), f'(x)), FR-010: 接線表示, FR-011: レスポンシブデザイン, FR-012: エラーハンドリング（不正入力）, FR-013: プリセット関数ボタン"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 基本関数の可視化 (Priority: P1)

As a student, I want to input a mathematical function and see its graph displayed instantly so that I can understand its shape and behavior visually.

**Why this priority**: Core functionality - without graph display, all other features are meaningless.
**Independent Test**: Input "x^2" and verify graph renders within 1 second.

**Acceptance Scenarios**:
1. **Given** the application is loaded, **When** user enters "x^2" in the input field, **Then** a parabola graph appears on the coordinate plane
2. **Given** a function is displayed, **When** user modifies the function to "sin(x)", **Then** the graph updates in real-time to show the sine wave
3. **Given** the graph area is displayed, **When** user views it, **Then** x-axis, y-axis, grid lines, and axis labels are visible

---

### User Story 2 - 導関数の理解 (Priority: P1)

As a calculus student, I want to see both the original function and its derivative simultaneously so that I can understand the relationship between a function and its rate of change.

**Why this priority**: Core differentiation feature - primary differentiator of this tool.
**Independent Test**: Input "x^3" and verify both f(x) and f'(x) = 3x^2 are displayed.

**Acceptance Scenarios**:
1. **Given** user has entered a function "x^2", **When** derivative option is enabled, **Then** the derivative "2x" is calculated and displayed as formula text
2. **Given** derivative is calculated, **When** user views the graph, **Then** both original function and derivative function are shown as overlapping graphs with different colors
3. **Given** both graphs are displayed, **When** user hovers over any point on the graph, **Then** tooltip shows x, f(x), and f'(x) values

---

### User Story 3 - 接線の視覚化 (Priority: P2)

As a calculus student, I want to see the tangent line at any point on the graph so that I can understand the geometric meaning of derivatives.

**Why this priority**: Enhances understanding of derivative concept but builds on Story 2.
**Independent Test**: Enable tangent line mode, click on graph at x=1 for f(x)=x^2, verify tangent line y=2x-1 is displayed.

**Acceptance Scenarios**:
1. **Given** a function is displayed, **When** user enables tangent line mode and clicks on the graph, **Then** a tangent line at that point is drawn
2. **Given** tangent line is displayed, **When** user moves cursor to different x position, **Then** tangent line updates to reflect the new point
3. **Given** derivative function exists, **When** tangent line is shown, **Then** the slope equals f'(x) at the selected point

---

### User Story 4 - 複数関数の比較 (Priority: P2)

As a student, I want to compare multiple mathematical functions side by side so that I can understand their differences.

**Why this priority**: Useful for learning but not essential for core single-function analysis.
**Independent Test**: Enter multiple preset functions and verify all render simultaneously with distinct colors.

**Acceptance Scenarios**:
1. **Given** user clicks preset buttons for "sin(x)" and "cos(x)", **When** both are added, **Then** both graphs appear with different colors and a legend
2. **Given** multiple functions are displayed, **When** user hovers over any graph line, **Then** the corresponding function is highlighted

---

### User Story 5 - モバイルでの利用 (Priority: P3)

As a mobile user, I want to use the visualizer on my phone so that I can study calculus anywhere.

**Why this priority**: Accessibility enhancement - important but core features work without it.
**Independent Test**: Open application on mobile viewport (width < 768px), verify graph is usable with touch interactions.

**Acceptance Scenarios**:
1. **Given** application is opened on mobile device, **When** user views the interface, **Then** all controls are accessible and properly sized for touch
2. **Given** mobile viewport, **When** user pinches on graph area, **Then** zoom in/out works correctly

---

### Edge Cases
- What happens when user enters invalid syntax like "sin("? System displays error message without crashing
- How does system handle division by zero points (e.g., "1/x" at x=0)? System shows gap in graph at undefined points
- What happens with extremely large or small values? Auto-zoom adjusts scale appropriately
- How does system handle nested functions like "sin(cos(x))"? System calculates and displays correctly
- What happens when user enters an empty input? Graph area shows empty or default state

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST display an interactive function graph on a 2D coordinate plane
- **FR-002**: System MUST provide a text input field for entering mathematical expressions
- **FR-003**: System MUST update the graph in real-time as the user types (debounce 300ms)
- **FR-004**: System MUST automatically zoom and scale the graph to fit the visible portion of the function
- **FR-005**: System MUST display axis labels (x, y) and grid lines on the coordinate plane
- **FR-006**: System MUST support standard mathematical functions: sin, cos, tan, log, exp, sqrt, abs
- **FR-007**: System MUST calculate and display the derivative (導関数) of the input function
- **FR-008**: System MUST overlay the derivative graph on the original function graph with visual distinction (different color)
- **FR-009**: System MUST show a cursor-following tooltip displaying x-coordinate, f(x), and f'(x) values
- **FR-010**: System MUST display the tangent line at a user-selected point on the graph
- **FR-011**: System MUST adapt layout responsively for desktop and mobile viewports
- **FR-012**: System MUST handle invalid input gracefully with user-friendly error messages (no crashes)
- **FR-013**: System MUST provide preset function buttons for common functions (sin(x), cos(x), x^2, x^3, log(x), exp(x))

### Key Entities
- **Function Expression**: String representation of mathematical function, supports standard notation (e.g., "x^2", "sin(x)", "2*x+1")
- **Graph Coordinate System**: 2D plane with x-axis, y-axis, configurable range and scale
- **Derivative**: Calculated derivative expression from original function, displayed as formula and graph
- **Tangent Line**: Linear equation y = f'(a)(x-a) + f(a) at point x=a, visualized as overlay line
- **Tooltip Data**: Triple (x, f(x), f'(x)) updated continuously as cursor moves across graph
- **Preset Function**: Predefined function expression accessible via button click

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: Users can input any supported function and see the graph render within 1 second
- **SC-002**: Graph updates occur with less than 100ms latency after typing stops (debounced)
- **SC-003**: Derivative calculation and display completes within 500ms for any supported function
- **SC-004**: Application functions correctly on viewports ranging from 320px to 1920px width
- **SC-005**: Error handling prevents application crashes for any user input (100% error-free sessions)
- **SC-006**: Tooltip updates at minimum 30fps during cursor movement for smooth experience
- **SC-007**: All mathematical functions (sin, cos, tan, log, exp, sqrt, abs) render accurately within ±0.001 precision
- **SC-008**: Users can toggle between original function, derivative, and tangent line views independently
- **SC-009**: Preset function buttons reduce function entry time by at least 50% compared to manual typing

---

# Specification Quality Checklist: 関数ビジュアライザー（微分機能付き）

**Purpose**: Validate spec completeness before planning
**Created**: 2026-02-17

## Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value; written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and technology-agnostic
- [x] All acceptance scenarios defined
- [x] Edge cases identified; scope clearly bounded

## Feature Readiness
- [x] All functional requirements have acceptance criteria
- [x] User scenarios cover primary flows
- [x] No implementation details leak into specification

---

## Report

**Branch**: `002-function-visualizer-diff`
**Spec Path**: `specs/002-function-visualizer-diff/spec.md`
**Checklist Path**: `specs/002-function-visualizer-diff/checklists/requirements.md`
**Status**: Specification complete, ready for `/poor-dev.suggest` or `/poor-dev.plan`
**Unresolved Items**: None
