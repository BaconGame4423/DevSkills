# Implementation Plan: 関数ビジュアライザー（微分機能付き）

**Date**: 2026-02-17
**Input**: Feature specification from spec.md

## Summary

インタラクティブな関数グラフ描画ツールを開発し、数式入力からリアルタイムでグラフを表示、数値微分による導関数計算、カーソル追従ツールチップ、接線表示を提供する。math.jsによる数式パース・評価、Chart.jsによるグラフ描画、中心差分法による数値微分を実装し、教育用途に最適化したUXを提供する。

## Technical Context

**Language/Version**: HTML5 + CSS3 + Vanilla JavaScript (ES6+)
**Primary Dependencies**: 
- math.js v12+ (数式パーサー・評価)
- Chart.js v4+ (グラフ描画)
**Storage**: なし（クライアントサイドのみ）
**Testing**: 手動テスト（ユーザーシナリオベース）
**Target Platform**: モダンブラウザ（Chrome, Firefox, Safari, Edge）

## Project Structure

```text
specs/004-fr001-fr002-fr003-fr004/
├── index.html           # メインHTML（UI構造）
├── styles.css           # レスポンシブスタイル
├── app.js               # アプリケーションロジック
├── math-engine.js       # 数式解析・微分計算
└── graph-renderer.js    # グラフ描画・インタラクション
```

**Structure Decision**: 機能別分離による保守性向上。数式処理とグラフ描画を独立したモジュールに分割し、テスト容易性と将来的な拡張（記号微分への切り替え等）を考慮。

## Architecture

### Component Overview

| コンポーネント | 責務 |
|---------------|------|
| **index.html** | UI構造定義（入力フィールド、プリセットボタン、グラフキャンバス） |
| **styles.css** | レスポンシブレイアウト、グリッド/Flexbox、モバイル対応 |
| **app.js** | イベントハンドリング、状態管理、コンポーネント間の調整 |
| **math-engine.js** | 数式パース・評価、数値微分計算、エラーハンドリング |
| **graph-renderer.js** | Chart.js初期化・設定、グラフ更新、ツールチップ制御、接線描画 |

### Data Flow

```
[ユーザー入力] → debounce(300ms) → [math-engine.js: パース・評価]
                                         ↓
                                    [有効/無効判定]
                                    ↓         ↓
                              [エラー表示]  [数値微分計算]
                                               ↓
                              [graph-renderer.js: グラフ更新]
                                               ↓
                              [Chart.js: キャンバス描画]
                                               ↓
                              [カーソルイベント] → [ツールチップ更新]
                                               → [接線再描画]
```

### Contracts & Interfaces

```javascript
// math-engine.js exports
parseExpression(expr: string): { valid: boolean, fn: Function, error?: string }
numericalDerivative(fn: Function, x: number, h?: number): number
evaluateAt(fn: Function, x: number): number

// graph-renderer.js exports
initGraph(canvasId: string): Chart
updateGraph(chart: Chart, functions: Array<{fn: Function, label: string, color: string}>): void
setTangentLine(chart: Chart, x: number, derivative: number, f_x: number): void
updateTooltip(x: number, f_x: number, df_x: number): void

// app.js state
interface AppState {
  expressions: string[]           // 複数関数対応
  showDerivative: boolean
  showTangent: boolean
  cursorX: number | null
  error: string | null
}
```

## Implementation Approach

### Phase 0: Research (完了)

suggestions.md で調査済み:
- math.js の数式パース・評価API確認
- Chart.js の line chart 設定・ツールチップカスタマイズ
- 中心差分法: `f'(x) ≈ (f(x+h) - f(x-h)) / (2h)`、h=1e-5

### Phase 1: Design

**設計決定事項**:

1. **グラフ描画ライブラリ**: Chart.js (S002) を採用
   - Canvas API直接使用 (S006) は実装コストが高く、Chart.jsのツールチップ機能がFR-009要件を満たす
   
2. **数値微分実装**: 中心差分法 (S003) を採用
   - 記号微分は複雑で、教育用途では数値微分で十分な精度
   
3. **複数関数表示**: Chart.jsの複数dataset機能で実現
   - 各関数ごとにdatasetを作成し、自動で色分け

4. **リアルタイム更新**: debounce 300ms (S004) を採用
   - SC-001の「1秒以内」要件を余裕で満たす

5. **エラーハンドリング**: math.jsの例外をcatch (S007)
   - 日本語エラーメッセージ変換テーブルを用意

6. **レスポンシブ**: CSS Grid + Flexbox (S005)
   - ブレークポイント: 768px (タブレット), 1024px (デスクトップ)

**トレードオフ**:
- 数値微分 vs 記号微分: 精度よりも実装シンプルさを優先
- Chart.js vs Canvas API: 機能豊富さよりも開発速度を優先
- エクスポート機能: 今回はスコープ外（clarificationで確認済み）

### Phase 2: Implementation Steps

1. **HTML構築**: 入力フィールド、プリセットボタン、グラフキャンバス、表示オプショントグル
2. **CSS実装**: Grid/Flexboxレイアウト、メディアクエリ
3. **math-engine.js実装**: 
   - math.js初期化・標準関数登録
   - parseExpression: try-catchでパース・エラーハンドリング
   - numericalDerivative: 中心差分法実装
4. **graph-renderer.js実装**:
   - Chart.js初期化（axes, grid, legend設定）
   - 複数dataset対応
   - ツールチップカスタマイズ（x, f(x), f'(x)表示）
   - 接線dataset追加・更新
5. **app.js実装**:
   - debounce付き入力ハンドラー
   - プリセットボタンクリック処理
   - 状態管理・コンポーネント連携
6. **統合テスト**: ユーザーシナリオ1-6の手動確認

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| tan(x)等の不連続点でのグラフ崩れ | 高 | Y軸範囲制限（-100〜100）、Chart.jsのspanGapsオプション |
| 数値微分の精度低下（急峻な関数） | 中 | h値を関数の特性に応じて動的調整（1e-5〜1e-7） |
| モバイルでのツールチップ操作困難 | 中 | タッチイベント対応、拡大ツールチップ表示 |
| math.js読み込みサイズ（大規模） | 低 | CDN利用、gzip圧縮で約50KB |
| 複雑な数式のパフォーマンス劣化 | 低 | debounce + キャッシングで再計算回避 |

[PROGRESS: plan complete]
