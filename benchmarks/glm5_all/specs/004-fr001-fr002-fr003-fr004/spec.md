
# Feature Specification: 関数ビジュアライザー（微分機能付き）

**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "微分機能付きインタラクティブ数学ツール「関数ビジュアライザー」を開発してください。要件: FR-001: インタラクティブ関数グラフ表示, FR-002: 数式入力フィールド, FR-003: リアルタイムグラフ更新, FR-004: 自動ズーム/スケール, FR-005: 軸ラベルとグリッド線, FR-006: 複数関数サポート (sin,cos,tan,log,exp,sqrt,abs), FR-007: 微分（導関数）の計算と表示, FR-008: 導関数のグラフ重畳表示, FR-009: カーソル追従ツールチップ (x, f(x), f'(x)), FR-010: 接線表示, FR-011: レスポンシブデザイン, FR-012: エラーハンドリング（不正入力）, FR-013: プリセット関数ボタン"

## User Scenarios & Testing

### User Story 1 - 基本関数の可視化 (Priority: P1)

学生が数学の学習中に sin(x) や x^2 などの関数を入力し、そのグラフを視覚的に理解したい。

**Why this priority**: 核心機能であり、他の全ての機能の基盤となる。
**Independent Test**: 数式を入力し、グラフが正しく描画されることを目視確認。

**Acceptance Scenarios**:
1. **Given** ユーザーがツールを開いた状態, **When** 「sin(x)」と入力してEnter, **Then** 正弦波グラフが表示される
2. **Given** グラフが表示されている, **When** 数式を「cos(x)」に変更, **Then** リアルタイムで余弦波に切り替わる
3. **Given** 数式入力フィールド, **When** 不正な数式「abc」を入力, **Then** エラーメッセージが表示され、グラフは更新されない

---

### User Story 2 - 導関数の理解 (Priority: P1)

微積分を学ぶ学生が、元の関数とその導関数の関係を視覚的に比較したい。

**Why this priority**: このツールの差別化機能であり、教育価値が高い。
**Independent Test**: 関数を入力し、導関数表示を有効にして、両方のグラフが重畳表示されることを確認。

**Acceptance Scenarios**:
1. **Given** 「x^2」のグラフが表示されている, **When** 導関数表示をオンにする, **Then** f'(x) = 2x のグラフが異なる色で重畳表示される
2. **Given** 導関数が表示されている, **When** 関数を「sin(x)」に変更, **Then** 導関数も自動的に「cos(x)」に更新される

---

### User Story 3 - カーソルによる値の確認 (Priority: P1)

ユーザーがグラフ上の特定の点で、x座標、関数値、導関数値を正確に知りたい。

**Why this priority**: 数学的理解に不可欠なインタラクティブ機能。
**Independent Test**: グラフ上でカーソルを移動し、ツールチップの値が正しいことを計算で確認。

**Acceptance Scenarios**:
1. **Given** グラフが表示されている, **When** カーソルをグラフ上に移動, **Then** ツールチップに x, f(x), f'(x) が表示される
2. **Given** カーソルが x=0 の位置, **When** 関数が「sin(x)」, **Then** ツールチップは f(0)=0, f'(0)=1 を表示

---

### User Story 4 - 接線の可視化 (Priority: P2)

ユーザーが特定の点における接線を視覚的に理解し、接線の傾きが導関数と一致することを確認したい。

**Why this priority**: 微分の幾何学的意味を理解するのに役立つ。
**Independent Test**: 接線表示を有効にし、カーソル位置に接線が描画されることを確認。

**Acceptance Scenarios**:
1. **Given** 関数と導関数が表示されている, **When** 接線表示をオンにする, **Then** カーソル位置に接線が描画される
2. **Given** 接線が表示されている, **When** カーソルを移動, **Then** 接線もリアルタイムで更新される

---

### User Story 5 - プリセット関数の活用 (Priority: P2)

初心者が一般的な関数を素早く試したい。

**Why this priority**: 初心者の参入障壁を下げる。
**Independent Test**: プリセットボタンをクリックし、対応する関数が即座に入力・表示されることを確認。

**Acceptance Scenarios**:
1. **Given** ツールを開いた状態, **When** 「sin(x)」プリセットボタンをクリック, **Then** 入力フィールドに「sin(x)」が入り、グラフが表示される
2. **Given** 任意の関数が入力されている, **When** 別のプリセットをクリック, **Then** 新しい関数に入れ替わる

---

### User Story 6 - 複数デバイスでの利用 (Priority: P2)

ユーザーがPC、タブレット、スマートフォンのいずれでも快適にツールを利用したい。

**Why this priority**: アクセシビリティと利便性の向上。
**Independent Test**: 各デバイスサイズでUIが適切に配置され、操作可能であることを確認。

**Acceptance Scenarios**:
1. **Given** スマートフォンでツールを開いた, **When** 画面を回転, **Then** グラフとUIが適切にリサイズされる
2. **Given** タブレットでツールを開いた, **When** タッチでピンチイン/アウト, **Then** グラフのズームが調整される

---

### Edge Cases
- 不連続関数（tan(x)の漸近線付近）ではどう表示されるか？
- 複合関数（sin(x^2)など）の微分は正しく計算されるか？
- x軸・y軸のスケールが大きく異なる場合、自動ズームはどう動作するか？
- 無限大やNaNを返す入力（log(-1)など）のエラーハンドリングは？
- 極めて長い数式や複雑な数式のパフォーマンスは？

## Requirements

### Functional Requirements
- **FR-001**: System MUST display interactive function graphs on a coordinate plane
- **FR-002**: System MUST provide a mathematical expression input field
- **FR-003**: System MUST update the graph in real-time as the user modifies the expression
- **FR-004**: System MUST automatically adjust zoom and scale to fit the function's relevant range
- **FR-005**: System MUST display axis labels and grid lines on the graph
- **FR-006**: System MUST support standard mathematical functions: sin, cos, tan, log, exp, sqrt, abs
- **FR-007**: System MUST compute and display the derivative (derivative function) of the input expression
- **FR-008**: System MUST overlay the derivative graph on the original function graph with visual distinction
- **FR-009**: System MUST show a cursor-following tooltip displaying x, f(x), and f'(x) values
- **FR-010**: System MUST display the tangent line at the cursor position when enabled
- **FR-011**: System MUST provide responsive design for desktop, tablet, and mobile devices
- **FR-012**: System MUST handle invalid input gracefully with clear error messages
- **FR-013**: System MUST provide preset function buttons for quick selection

### Key Entities (if data involved)
- **Function Expression**: ユーザー入力の数式文字列、解析済みAST、有効/無効状態
- **Graph State**: 現在の表示範囲（x_min, x_max, y_min, y_max）、ズームレベル
- **Cursor Position**: 現在のカーソルx座標、対応するf(x)値、f'(x)値
- **Display Options**: 導関数表示ON/OFF、接線表示ON/OFF、グリッド表示ON/OFF

## Success Criteria

### Measurable Outcomes
- **SC-001**: ユーザーは数式入力から1秒以内にグラフを見ることができる
- **SC-002**: 導関数計算は100ms以内に完了し、リアルタイム更新を妨げない
- **SC-003**: ツールチップの更新はカーソル移動に追随し、遅延が50ms以内
- **SC-004**: 95%以上の有効な数学的入力に対して正しいグラフと導関数を表示
- **SC-005**: モバイルデバイス（375px幅）でも全機能が操作可能

---

[NEEDS CLARIFICATION: 導関数の計算方法（数値微分 vs 記号微分）に優先順位はありますか？記号微分はより正確ですが実装が複雑になります。]
[NEEDS CLARIFICATION: 複数関数の同時表示（例：sin(x)とcos(x)を重ねて表示）は要件に含まれますか？]
[NEEDS CLARIFICATION: グラフのエクスポート機能（PNG/PDF出力）は将来のロードマップに含まれますか？]

## Clarifications

### 2026-02-17

**Questions:**

  1. 導関数の計算方法（数値微分 vs 記号微分）に優先順位はありますか？記号微分はより正確ですが実装が複雑になります。
  2. 複数関数の同時表示（例：sin(x)とcos(x)を重ねて表示）は要件に含まれますか？
  3. グラフのエクスポート機能（PNG/PDF出力）は将来のロードマップに含まれますか？

**Answers:**

1. 導関数の計算方法: デフォルトを採用（数値微分を優先、実装がシンプルで十分な精度）
2. 複数関数の同時表示: デフォルトを採用（複数の関数を同じグラフ上に重ねて表示可能）
3. グラフのエクスポート機能: デフォルトを採用（現段階ではエクスポート機能なし、必要なら将来追加）

