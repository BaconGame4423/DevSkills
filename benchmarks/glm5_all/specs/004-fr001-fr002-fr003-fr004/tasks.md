# Tasks: 関数ビジュアライザー（微分機能付き）

## Phase 1: Setup

- [ ] T001 プロジェクトディレクトリとファイル構造の作成
  - files: specs/004-fr001-fr002-fr003-fr004/**
- [ ] T002 HTMLファイルの雛形作成とCDN依存関係（math.js, Chart.js）の追加 in index.html
  - depends: [T001]
  - files: specs/004-fr001-fr002-fr003-fr004/index.html

## Phase 2: Foundational

- [ ] T003 [P] CSS基盤スタイルの実装（リセット、変数、Grid/Flexboxレイアウト） in styles.css
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T004 [P] math-engine.js モジュール雛形とエクスポート定義
  - files: specs/004-fr001-fr002-fr003-fr004/math-engine.js
- [ ] T005 [P] graph-renderer.js モジュール雛形とエクスポート定義
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T006 [P] app.js 状態管理とイベントハンドラの雛形
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 3: User Story 1 - 基本関数の可視化 (P1)

**Story Goal**: 学生が数学の学習中に sin(x) や x^2 などの関数を入力し、そのグラフを視覚的に理解したい。
**Independent Test**: 数式を入力し、グラフが正しく描画されることを目視確認。

- [ ] T007 [US1] [P] HTML UI構造の実装（入力フィールド、グラフキャンバス、エラー表示エリア） in index.html
  - depends: [T002, T003]
  - files: specs/004-fr001-fr002-fr003-fr004/index.html
- [ ] T008 [US1] [P] CSSコンポーネントスタイル（入力フィールド、キャンバスコンテナ、エラーメッセージ） in styles.css
  - depends: [T003]
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T009 [US1] math-engine.js: parseExpression() 関数の実装（math.jsパース・評価・エラーハンドリング）
  - depends: [T004]
  - files: specs/004-fr001-fr002-fr003-fr004/math-engine.js
- [ ] T010 [US1] graph-renderer.js: initGraph() と updateGraph() の実装（Chart.js初期化・単一dataset描画）
  - depends: [T005]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T011 [US1] app.js: debounce付き入力ハンドラーとグラフ更新フローの実装
  - depends: [T006, T007, T009, T010]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 4: User Story 2 - 導関数の理解 (P1)

**Story Goal**: 微積分を学ぶ学生が、元の関数とその導関数の関係を視覚的に比較したい。
**Independent Test**: 関数を入力し、導関数表示を有効にして、両方のグラフが重畳表示されることを確認。

- [ ] T012 [US2] [P] HTML: 導関数表示トグルUIの追加 in index.html
  - depends: [T007]
  - files: specs/004-fr001-fr002-fr003-fr004/index.html
- [ ] T013 [US2] [P] CSS: トグルボタンスタイルの追加 in styles.css
  - depends: [T008]
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T014 [US2] math-engine.js: numericalDerivative() 関数の実装（中心差分法 h=1e-5）
  - depends: [T009]
  - files: specs/004-fr001-fr002-fr003-fr004/math-engine.js
- [ ] T015 [US2] graph-renderer.js: 複数dataset対応と導関数グラフの重畳表示
  - depends: [T010]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T016 [US2] app.js: 導関数トグル状態管理とリアルタイム更新
  - depends: [T011, T012, T014, T015]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 5: User Story 3 - カーソルによる値の確認 (P1)

**Story Goal**: ユーザーがグラフ上の特定の点で、x座標、関数値、導関数値を正確に知りたい。
**Independent Test**: グラフ上でカーソルを移動し、ツールチップの値が正しいことを計算で確認。

- [ ] T017 [US3] graph-renderer.js: Chart.jsツールチップカスタマイズ（x, f(x), f'(x)表示）
  - depends: [T015]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T018 [US3] [P] CSS: ツールチップスタイル調整 in styles.css
  - depends: [T013]
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T019 [US3] app.js: カーソルイベント処理とツールチップ連携
  - depends: [T016, T017]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 6: User Story 4 - 接線の可視化 (P2)

**Story Goal**: ユーザーが特定の点における接線を視覚的に理解し、接線の傾きが導関数と一致することを確認したい。
**Independent Test**: 接線表示を有効にし、カーソル位置に接線が描画されることを確認。

- [ ] T020 [US4] [P] HTML: 接線表示トグルUIの追加 in index.html
  - depends: [T012]
  - files: specs/004-fr001-fr002-fr003-fr004/index.html
- [ ] T021 [US4] graph-renderer.js: setTangentLine() 関数の実装（接線dataset追加・更新）
  - depends: [T017]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T022 [US4] app.js: 接線トグル状態管理とカーソル追従更新
  - depends: [T019, T020, T021]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 7: User Story 5 - プリセット関数の活用 (P2)

**Story Goal**: 初心者が一般的な関数を素早く試したい。
**Independent Test**: プリセットボタンをクリックし、対応する関数が即座に入力・表示されることを確認。

- [ ] T023 [US5] [P] HTML: プリセット関数ボタン群の追加 in index.html
  - depends: [T020]
  - files: specs/004-fr001-fr002-fr003-fr004/index.html
- [ ] T024 [US5] [P] CSS: プリセットボタングリッドレイアウト in styles.css
  - depends: [T018]
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T025 [US5] app.js: プリセットボタンクリックハンドラーと入力フィールド連携
  - depends: [T022, T023]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 8: User Story 6 - 複数デバイスでの利用 (P2)

**Story Goal**: ユーザーがPC、タブレット、スマートフォンのいずれでも快適にツールを利用したい。
**Independent Test**: 各デバイスサイズでUIが適切に配置され、操作可能であることを確認。

- [ ] T026 [US6] CSS: レスポンシブブレークポイント実装（768px, 1024px）とモバイル最適化 in styles.css
  - depends: [T024]
  - files: specs/004-fr001-fr002-fr003-fr004/styles.css
- [ ] T027 [US6] graph-renderer.js: タッチイベント対応とグラフリサイズ処理
  - depends: [T021]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js
- [ ] T028 [US6] app.js: リサイズイベントハンドラーとCanvas再描画
  - depends: [T025, T026, T027]
  - files: specs/004-fr001-fr002-fr003-fr004/app.js

## Phase 9: Integration & Polish

- [ ] T029 エッジケース対応: tan(x)不連続点でのY軸範囲制限とspanGaps設定
  - depends: [T028]
  - files: specs/004-fr001-fr002-fr003-fr004/graph-renderer.js, specs/004-fr001-fr002-fr003-fr004/app.js
- [ ] T030 エラーハンドリング強化: 日本語エラーメッセージ変換とユーザーフレンドリー表示
  - depends: [T029]
  - files: specs/004-fr001-fr002-fr003-fr004/math-engine.js, specs/004-fr001-fr002-fr003-fr004/app.js
- [ ] T031 最終統合テスト: ユーザーシナリオ1-6の手動確認とバグ修正
  - depends: [T030]
  - files: specs/004-fr001-fr002-fr003-fr004/**

[PROGRESS: tasks complete]
