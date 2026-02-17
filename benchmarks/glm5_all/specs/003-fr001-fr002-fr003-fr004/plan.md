# Implementation Plan: 関数ビジュアライザー（Function Visualizer with Differentiation）

**Date**: 2026-02-17
**Input**: Feature specification from spec.md

## Summary

インタラクティブな関数グラフ描画ツールを開発。math.js による数式パースと function-plot による Canvas 描画を組み合わせ、リアルタイムでグラフ更新・導関数の重畳表示・カーソル追従ツールチップ・接線描画を提供する。数値微分は中心差分法で実装し、60fps のスムーズな UX を実現する。

## Technical Context

**Language/Version**: JavaScript (ES6+), HTML5, CSS3
**Primary Dependencies**: 
- function-plot (v1.x) - グラフ描画
- math.js (v11.x) - 数式パース・評価
**Storage**: なし（クライアントサイドのみ、状態はメモリ管理）
**Testing**: 手動テスト（ユーザーストーリーベース）
**Target Platform**: モダンブラウザ（Chrome, Firefox, Safari, Edge）

## Project Structure

```text
function-visualizer/
├── index.html           # エントリーポイント、UIレイアウト
├── css/
│   └── styles.css       # レスポンシブスタイル、レイアウト
├── js/
│   ├── main.js          # 初期化、イベントバインディング
│   ├── graph.js         # function-plot ラッパー、描画制御
│   ├── derivative.js    # 数値微分（中心差分法）
│   ├── input.js         # 数式入力処理、バリデーション
│   ├── tooltip.js       # カーソル追従ツールチップ
│   └── tangent.js       # 接線描画ロジック
└── lib/
    └── (CDN経由で math.js, function-plot を読み込み)
```

**Structure Decision**: 機能単位でモジュール分割し、責務を明確化。CDN 利用でビルドツール不要の軽量構成を採用。

## Architecture

### Component Overview

1. **InputController** (`input.js`): 数式入力の管理、debounce 付きリアルタイム更新、エラーハンドリング
2. **GraphRenderer** (`graph.js`): function-plot の初期化・更新、複数系列（元関数・導関数）管理
3. **DerivativeCalculator** (`derivative.js`): 中心差分法による数値微分、f'(x) 配列生成
4. **TooltipManager** (`tooltip.js`): カーソル位置検知、x/f(x)/f'(x) 値の取得・表示
5. **TangentRenderer** (`tangent.js`): カーソル位置での接線計算・描画
6. **AppOrchestrator** (`main.js`): コンポーネント間の連携、ResizeObserver によるレスポンシブ制御

### Data Flow

```
[User Input] 
    ↓ (debounce 150ms)
[InputController: parse with math.js]
    ↓ (try-catch)
[GraphRenderer: evaluate points] → [DerivativeCalculator: f'(x)]
    ↓                                    ↓
[function-plot: render f(x) + f'(x)]  [TooltipManager: x, f(x), f'(x)]
    ↓                                    ↓
[Canvas Display]                    [TangentRenderer: 接線描画]
```

### Contracts & Interfaces

```javascript
// InputController → GraphRenderer
{ expression: string, isValid: boolean, error?: string }

// DerivativeCalculator
computeDerivative(evaluateFn: (x: number) => number, xRange: [number, number], step: number): { x: number, dy: number }[]

// TooltipManager
updateTooltip(mouseX: number): { x: number, fx: number, dfx: number }

// TangentRenderer
renderTangentAt(x: number, fx: number, dfx: number): void
```

## Implementation Approach

### Phase 0: Research (if needed)

function-plot の tooltip/tangent カスタマイズ方法を確認。function-plot は `tip` オプションとカスタムレイヤー追加をサポートしているため、ツールチップと接線は `graph.on('mouseover')` イベント + 追加 Canvas レイヤーで実装可能。

### Phase 1: Design

**トレードオフ**:
- 数値微分 vs シンボリック微分: 数値を選択（Clarification 推奨）。実装簡潔・高速だが、数式表示不可。
- CDN vs バンドル: CDN 選択。ビルド不要だが、オフライン動作不可。
- function-plot カスタマイズ vs 自前 Canvas: function-plot 選択。開発高速化だが、細かい制御に制限あり。

**並列実装可能な境界**:
- `derivative.js` と `input.js` は独立実装可能
- `tooltip.js` と `tangent.js` は `graph.js` インターフェース確定後並列実装可能

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 複雑な合成関数で数値微分の精度低下 | 導関数グラフが不正確 | ステップサイズ h を動的調整（1e-5〜1e-8）、必要に応じてリチャードソン外挿法 |
| function-plot の tooltip API 制限 | 接線表示が困難 | カスタム SVG/Canvas レイヤーを function-plot 上に重ねて実装 |
| math.js パースエラーの多様性 | エラーメッセージが不親切 | エラー型を分類（構文エラー・定義域エラー・未定義関数）し、日本語メッセージに変換 |
| モバイルでカーソル追従が困難 | タッチ操作でツールチップ不可 | タッチイベント対応（touchmove）、タップ位置を基準にツールチップ表示 |
| Canvas 高DPI対応 | Retina ディスプレイでぼやける | devicePixelRatio を考慮した Canvas スケーリング |

[PROGRESS: plan complete]
