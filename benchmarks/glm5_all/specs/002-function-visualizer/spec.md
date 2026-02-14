# Feature Specification: Function Visualizer with Calculus

**Feature Branch**: `002-function-visualizer`
**Created**: 2026-02-14
**Status**: Draft
**Input**: 微分機能付きインタラクティブ数学ツール「関数ビジュアライザー」を開発してください。要件: FR-001〜FR-013

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 基本関数の可視化 (Priority: P1)

数学を学ぶ学生が、数式を入力してグラフを直ちに確認したい。sin(x)やx²などの基本的な関数を入力し、リアルタイムでグラフが描画される。

**Why this priority**: 核心機能であり、他の全ての機能の基盤
**Independent Test**: 数式入力フィールドに"sin(x)"と入力し、正弦波が表示されることを確認

**Acceptance Scenarios**:
1. **Given** アプリケーションを開いた状態, **When** "x^2"と入力, **Then** 放物線が表示される
2. **Given** グラフが表示されている, **When** 数式を変更, **Then** グラフがリアルタイムで更新される

---

### User Story 2 - 導関数の理解 (Priority: P1)

微積分を学ぶ学生が、関数とその導関数の関係を視覚的に理解したい。元の関数と導関数を同じ座標系で比較できる。

**Why this priority**: このツールの差別化機能（微分機能）
**Independent Test**: 関数を入力し、導関数トグルを有効にして、導関数グラフが重畳表示されることを確認

**Acceptance Scenarios**:
1. **Given** "x^3"が入力されている, **When** 導関数表示を有効化, **Then** "3x^2"のグラフが重畳表示される
2. **Given** 導関数が表示されている, **When** 元の関数を変更, **Then** 導関数も自動更新される

---

### User Story 3 - 特定点での分析 (Priority: P2)

ユーザーがグラフ上の特定の点における関数値、導関数値、接線を確認したい。マウスカーソルを合わせることで詳細情報を得る。

**Why this priority**: 数学的理解を深める補助機能
**Independent Test**: グラフ上でカーソルを動かし、ツールチップにx、f(x)、f'(x)が表示されることを確認

**Acceptance Scenarios**:
1. **Given** グラフが表示されている, **When** カーソルをグラフ上に移動, **Then** ツールチップに現在のx、f(x)、f'(x)が表示される
2. **Given** 接線表示モード, **When** カーソルを特定のx座標に移動, **Then** その点での接線が表示される

---

### User Story 4 - クイックアクセス (Priority: P2)

ユーザーがよく使う関数を素早く入力したい。プリセットボタンで一般的な関数をワンクリックで入力できる。

**Why this priority**: ユーザビリティ向上
**Independent Test**: プリセットボタンをクリックし、対応する関数が入力フィールドに設定されることを確認

**Acceptance Scenarios**:
1. **Given** アプリケーションを開いた状態, **When** "sin"プリセットボタンをクリック, **Then** "sin(x)"が入力される
2. **Given** プリセットボタンが表示されている, **When** 各ボタンを確認, **Then** sin, cos, tan, log, exp, sqrt, absの7種類が存在する

---

### User Story 5 - エラーからの回復 (Priority: P3)

ユーザーが無効な数式を入力した場合、明確なエラーメッセージを受け取り、修正方法を理解できる。

**Why this priority**: 堅牢なUXの確保
**Independent Test**: 不正な数式を入力し、エラーメッセージが表示されることを確認

**Acceptance Scenarios**:
1. **Given** 入力フィールドが空, **When** "invalid(("と入力, **Then** 構文エラーメッセージが表示される
2. **Given** エラーが表示されている, **When** 有効な数式に修正, **Then** エラーが消え、グラフが表示される

---

### Edge Cases
- What happens when 関数が定義されていない点（例：1/xのx=0）? → グラフの不連続点として処理
- What happens when 非常に大きな数値や小さな数値? → 自動スケールで調整
- What happens when 複素数値が発生する計算（例：sqrt(-1)）? → 実数領域外として表示しないか警告

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST display an interactive function graph on a coordinate plane
- **FR-002**: System MUST provide a text input field for entering mathematical expressions
- **FR-003**: System MUST update the graph in real-time as the user types
- **FR-004**: System MUST automatically adjust zoom level and scale to fit the graph
- **FR-005**: System MUST display axis labels and grid lines on the coordinate plane
- **FR-006**: System MUST support the following functions: sin, cos, tan, log, exp, sqrt, abs
- **FR-007**: System MUST calculate and display the derivative (導関数) of the input function
- **FR-008**: System MUST overlay the derivative graph on the original function graph
- **FR-009**: System MUST display a cursor-following tooltip showing x, f(x), and f'(x) values
- **FR-010**: System MUST display the tangent line at the cursor position
- **FR-011**: System MUST implement responsive design for various screen sizes
- **FR-012**: System MUST handle invalid input gracefully with clear error messages
- **FR-013**: System MUST provide preset buttons for common functions (sin, cos, tan, log, exp, sqrt, abs)

### Key Entities
- **Function**: 数式文字列、パース済みAST、評価関数
- **Derivative**: 元の関数から生成された導関数
- **GraphViewport**: 表示範囲(x-min, x-max, y-min, y-max)、ズームレベル
- **Tooltip**: 現在のx座標、f(x)値、f'(x)値
- **TangentLine**: 接点のx座標、傾き(f'(x))、切片

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: Users can input a valid function and see its graph within 500ms of stopping typing
- **SC-002**: The derivative calculation and display updates within 200ms of function change
- **SC-003**: Tooltip response time is under 50ms for smooth cursor following
- **SC-004**: Application renders correctly on screens from 320px to 1920px width
- **SC-005**: 100% of invalid inputs result in a user-friendly error message (no crashes)
- **SC-006**: All preset buttons work correctly on first click
