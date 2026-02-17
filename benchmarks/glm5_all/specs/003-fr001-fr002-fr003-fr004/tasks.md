# Tasks: 関数ビジュアライザー（Function Visualizer with Differentiation）

## Phase 1: Setup

- [X] T001 プロジェクト構造の作成（index.html, css/, js/, lib/ ディレクトリ）
- [X] T002 HTMLエントリーポイント作成 in index.html（CDNリンク、基本レイアウト、入力フィールド、グラフ領域、プリセットボタン領域）

## Phase 2: Foundational

- [X] T003 [P] ベースCSSスタイル作成 in css/styles.css（レイアウト、グリッド、フォント、カラーテーマ）
  - files: css/styles.css
- [X] T004 [P] メイン初期化スクリプト作成 in js/main.js（AppOrchestrator、ResizeObserver、イベントバインディング枠組み）
  - files: js/main.js

## Phase 3: User Story 1 - 基本グラフ描画 (P1)

**Story Goal**: 学生や教育者が数式を入力し、視覚的に関数の振る舞いを理解できる
**Independent Test**: 入力フィールドに "x^2" を入力し、放物線が表示されることを確認

- [X] T005 [US1] [P] 数式入力コントローラー実装 in js/input.js（math.js パース、debounce 150ms、バリデーション、エラー分類）
  - depends: [T002]
  - files: js/input.js
- [X] T006 [US1] [P] グラフレンダラー実装 in js/graph.js（function-plot 初期化、軸ラベル、グリッド線、自動スケール、evaluteFn 生成）
  - depends: [T002]
  - files: js/graph.js
- [X] T007 [US1] 入力→グラフ連携 in js/main.js（InputController → GraphRenderer データフロー、エラー表示UI）
  - depends: [T005, T006, T004]
  - files: js/main.js, css/styles.css
- [X] T008 [US1] サポート関数テスト in js/input.js（sin, cos, tan, log, exp, sqrt, abs の評価確認）
  - depends: [T005]
  - files: js/input.js

## Phase 4: User Story 2 - 導関数の可視化 (P1)

**Story Goal**: 関数とその導関数の関係を視覚的に理解できる
**Independent Test**: x^2 を入力し、導関数 2x が自動計算・表示されることを確認

- [ ] T009 [US2] 数値微分計算器実装 in js/derivative.js（中心差分法、h=1e-5、xRange と step パラメータ、f'(x) 配列生成）
  - depends: [T006]
  - files: js/derivative.js
- [ ] T010 [US2] 導関数グラフ重畳表示 in js/graph.js（複数系列管理、元関数と導関数の異なる色で描画、導関数表示トグル）
  - depends: [T009, T006]
  - files: js/graph.js
- [ ] T011 [US2] 導関数UI統合 in js/main.js（導関数表示チェックボックス、GraphRenderer との連携、自動更新）
  - depends: [T010, T007]
  - files: js/main.js, index.html

## Phase 5: User Story 3 - カーソル追従と接線 (P2)

**Story Goal**: 特定の点での関数値、導関数値、接線の傾きを視覚的に確認できる
**Independent Test**: グラフ上でマウスを動かし、ツールチップに x, f(x), f'(x) が表示されることを確認

- [ ] T012 [US3] [P] カーソル追従ツールチップ実装 in js/tooltip.js（mouse position 取得、x/f(x)/f'(x) 計算、DOM表示更新、16fps制御）
  - depends: [T010]
  - files: js/tooltip.js
- [ ] T013 [US3] [P] 接線描画実装 in js/tangent.js（接線計算 y = f'(x0)(x - x0) + f(x0)、SVG/Canvas オーバーレイ、表示トグル）
  - depends: [T010]
  - files: js/tangent.js
- [ ] T014 [US3] ツールチップ・接線統合 in js/main.js（mousemove イベント、TooltipManager と TangentRenderer の連携、接線表示チェックボックス）
  - depends: [T012, T013, T011]
  - files: js/main.js, index.html, css/styles.css

## Phase 6: User Story 4 - プリセット関数と複数関数タイプ (P2)

**Story Goal**: よく使用される関数を素早く選択できる
**Independent Test**: プリセットボタン "sin(x)" をクリックし、正弦波が表示されることを確認

- [ ] T015 [US4] プリセットボタンUI実装 in index.html（sin, cos, tan, log, exp, sqrt, abs ボタン配置）
  - depends: [T002]
  - files: index.html, css/styles.css
- [ ] T016 [US4] プリセットクリックハンドラ実装 in js/main.js（入力フィールド上書き、グラフ更新トリガー）
  - depends: [T015, T007]
  - files: js/main.js

## Phase 7: User Story 5 - レスポンシブと自動スケール (P3)

**Story Goal**: 様々なデバイスで利用し、グラフが適切にスケールされる
**Independent Test**: ブラウザウィンドウサイズを変更し、グラフがリサイズされることを確認

- [ ] T017 [US5] レスポンシブCSS実装 in css/styles.css（メディアクエリ、モバイルレイアウト、タッチ対応サイズ）
  - depends: [T003]
  - files: css/styles.css
- [ ] T018 [US5] グラフリサイズ対応 in js/main.js（ResizeObserver、function-plot resize API、再描画）
  - depends: [T004, T006]
  - files: js/main.js
- [ ] T019 [US5] タッチイベント対応 in js/tooltip.js（touchmove、touchstart、タップ位置基準ツールチップ）
  - depends: [T012]
  - files: js/tooltip.js
- [ ] T020 [US5] 自動ズーム/スケール調整 in js/graph.js（値域解析、domain 自動設定、極値対応）
  - depends: [T006]
  - files: js/graph.js

## Phase 8: Integration & Polish

- [ ] T021 エラーハンドリング統合テスト（構文エラー、定義域エラー、未定義関数の日本語メッセージ）
  - depends: [T005, T007]
  - files: js/input.js, js/main.js
- [ ] T022 [P] highDPI Canvas対応 in js/graph.js（devicePixelRatio スケーリング）
  - depends: [T006]
  - files: js/graph.js
- [ ] T023 全User Story E2E確認（US1-US5 の Independent Test 実行、パフォーマンス計測 500ms/200ms/16ms）
  - depends: [T020, T016, T014, T011, T008]

---

**Summary**: 23 tasks across 8 phases
- Phase 1-2: 4 tasks (setup)
- Phase 3: 4 tasks (US1 - basic graph)
- Phase 4: 3 tasks (US2 - derivative)
- Phase 5: 3 tasks (US3 - tooltip/tangent)
- Phase 6: 2 tasks (US4 - presets)
- Phase 7: 4 tasks (US5 - responsive)
- Phase 8: 3 tasks (integration)

[PROGRESS: tasks complete]
