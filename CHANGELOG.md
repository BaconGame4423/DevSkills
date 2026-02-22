# Changelog

## [Unreleased]

### Added
- Bash Dispatch モード (`dispatch_mode: "bash"`) — `glm -p` 直接呼び出しで Agent Teams lifecycle オーバーヘッドを排除
- Agent Teams ベンチマークコンボ 3 件 (`claude_team`, `sonnet_team`, `claude_bash_glm5`)
- bench-team モニター改善 — チームスタック検出、ペインクリーンアップ、Claude Code TUI 対応
- Worker エージェントに WebSearch / WebFetch ツール付与 (`worker-suggest`, `worker-bugfix`)
- `poor-dev benchmark` CLI サブコマンド（setup/update/metrics/compare）
- benchmarks/ を npm パッケージに同梱（ソースのみ、生成物は除外）
- ベンチマーク出力ディレクトリの git 追跡を有効化
- `docs/glm-teammate.md` — GLM-5 Teammate セットアップガイドを README から分離

### Changed
- suggest ステップを plan Phase 0 に統合・削除（パイプライン 11 → 10 ステージ）
- レビューペルソナを統合（個別ペルソナコマンド 22 件削除）
- Reviewer Constraint-First プロンプト最適化
- ハイブリッドコンテキスト注入（ミッションクリティカル成果物のみ Opus が事前注入）
- `process_stages` を更新（`suggest` 削除、`testdesign` 追加）
- README.md をシンプル化（レビューペルソナ詳細・デュアルランタイム戦略・リビングダッシュボードを外出し）

### Removed
- レガシーパイプライン実行パス (`poor-dev.pipeline` / `poor-dev.md` / `poor-dev-simple.md`) を削除
- Bash lib/ スクリプト 20 ファイルを削除（独立ユーティリティの .mjs は残存）
- src/lib/ のレガシー TS ファイル 14 ファイルと対応テスト 6 ファイルを削除
- `team-state-machine.ts` のレガシーパス分岐（`useAgentTeams` / `DispatchStepAction` / `buildDispatchAction`）を削除

## [1.1.0] - 2026-02-13
### Added
- モデルティアシステム（T1/T2/T3）— ステップ別に最適モデルを自動選択（Plan-and-Execute）
- リスクベースレビュー深度（auto/deep/standard/light）— 変更規模に応じてペルソナ数と最大イテレーションを動的調整
- 投機的実行（specify → suggest 並列化）— 仕様作成と提案調査を並列で実行
- Contract-First 並列実装 — plan フェーズで contracts/ を生成し、DAG ベースの並列 dispatch を実現
- [P:group] 並列マーカー拡張 — tasks.md にグループ名・depends・files メタデータを追加
- レビューログウィンドウ制限 — 最新 2 イテレーション + fixed サマリーでトークン削減
- レビュー早期終了 — 3/4 GO で残りキャンセル、2/4 NO-GO で即 FIX
- constitution.md セクションマーカー — ステップ別に関連原則のみ送信
- poll-dispatch.sh インクリメンタルスキャン + inotifywait 対応
- ブロッキング待機によるポーリング最適化（ツール呼び出し 80% 削減）
- ステップ別コンテキストフィルタリング — 不要なアーティファクトを除外
- 大規模アーティファクトのセクション抽出（> 10KB で関連セクションのみ送信）
- 共通レビューループテンプレート（templates/review-loop.md）— 5 レビューの重複ロジックを集約

### Changed
- NON_INTERACTIVE_HEADER を圧縮（安全ルールは維持、冗長箇所を削除）
- config.json スキーマ拡張（tiers, step_tiers, review_depth, speculation, parallel）
- poor-dev.config コマンドに tier/step-tier/depth/speculation/parallel サブコマンド追加
- implement フェーズに DAG ベース並列 dispatch（3 戦略: same-branch/worktree/phase-split）
- Pipeline Context に Feature description サマリー最適化（初回以降は 1 行サマリー）

### Fixed
- README.md ペルソナ数 20 → 21 に修正（review-fixer を含む）

## [1.0.0] - 2026-02-13
### Added
- 初回リリース
- スラッシュコマンド群
- 21 レビューエージェントペルソナ（デュアルランタイム: Claude Code + OpenCode）
- CLI インストーラー (init/update/status)
