# Trace: pipeline-state.sh

**対象ファイル**: `lib/pipeline-state.sh` (173 行)
**管理する型**: `[CONTRACT: PipelineState]` (contracts.md Section 1)
**役割**: `pipeline-state.json` の CRUD 操作を提供するサブコマンド形式の bash スクリプト

---

## 1. contracts.md PipelineState 型との照合

contracts.md で定義された `PipelineState` インターフェースの各フィールドと、`pipeline-state.sh` の各サブコマンドでの操作を照合する。

| Field | contracts.md 型 | init (L47-69) | complete-step (L72-88) | set-status (L90-104) | set-variant (L106-120) | set-approval (L122-137) | clear-approval (L139-150) | set-pipeline (L152-166) |
|---|---|---|---|---|---|---|---|---|
| `flow` | `string` | `$flow` で設定 | -- | -- | -- | -- | -- | -- |
| `variant` | `string \| null` | `null` で初期化 | -- | -- | `$variant` で設定 | -- | -- | -- |
| `pipeline` | `string[]` | `$steps` で設定 | -- | -- | -- | -- | -- | `$steps` で置換 |
| `completed` | `string[]` | `[]` で初期化 | `+= [$step]`, `unique` | -- | -- | -- | -- | -- |
| `current` | `string \| null` | `$FIRST_STEP` (pipeline[0]) | 未完了先頭 or `null` | -- | -- | -- | -- | 未完了先頭 or `null` (再計算) |
| `status` | `PipelineStatus` | `"active"` | -- (変更しない) | `$status` で設定 | -- | `"awaiting-approval"` | `"active"` | -- |
| `pauseReason` | `string \| null` | `null` | -- | `$reason` or `null` | -- | `"{type} at {step}"` | `null` | -- |
| `condition` | `Record<string,unknown> \| null` | `null` | -- | -- | `$condition` (JSON) | -- | -- | -- |
| `pendingApproval` | `PendingApproval \| null` | `null` | -- | -- | -- | `{type, step}` | `null` | -- |
| `updated` | `string` (ISO 8601) | `$NOW` | `$NOW` | `$NOW` | `$NOW` | `$NOW` | `$NOW` | `$NOW` |
| `implement_phases_completed` | `string[]?` (optional) | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** |
| `retries` | `RetryRecord[]?` (optional) | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** | **未管理** |

### 不一致点

1. **`implement_phases_completed` が pipeline-state.sh で未管理**
   - `pipeline-runner.sh` L377-381 で直接 `jq` により `pipeline-state.json` を操作:
     ```bash
     updated=$(jq --arg phase "$phase" '
       .implement_phases_completed = ((.implement_phases_completed // []) + [$phase] | unique)
     ' "$state_file")
     echo "$updated" | jq '.' > "$state_file"
     ```
   - 読み取りも `pipeline-runner.sh` L407, L642 で直接 `jq -r '.implement_phases_completed[]?'`
   - pipeline-state.sh の抽象化を迂回しており、設計上の一貫性が欠けている

2. **`retries` が pipeline-state.sh で未管理**
   - `retry-helpers.sh` L184 で直接 `jq` により追記:
     ```bash
     '.retries = ((.retries // []) + [{"step": $step, "attempt": $attempt, "exit_code": $exit_code, "backoff": $backoff, "ts": $ts}])'
     ```
   - `STATE_FILE` グローバル変数経由でファイルパスを取得
   - pipeline-state.sh を経由しない直接書き込み

3. **型安全性の欠如**
   - `set-status` は任意の文字列を受け付ける。`PipelineStatus` のバリデーションなし
   - `set-approval` の `type` は任意の文字列。`"clarification" | "gate"` のバリデーションなし
   - `condition` は `--argjson` で渡されるため JSON パース時にエラーになるが、スキーマ検証はない

---

## 2. State Transition Table

`status` フィールドの遷移を全サブコマンドから導出する。

| From State | To State | Trigger (サブコマンド) | 条件 |
|---|---|---|---|
| (none) | `active` | `init` | 新規パイプライン作成時 |
| `active` | `active` | `complete-step` | 残りステップあり (current が次ステップに遷移) |
| `active` | `active` | `complete-step` | 全ステップ完了 (current=null, status は active のまま) |
| `active` | `paused` | `set-status "paused"` | 理由任意 |
| `active` | `rate-limited` | `set-status "rate-limited"` | 理由任意 |
| `active` | `completed` | `set-status "completed"` | パイプライン完了時 |
| `active` | `awaiting-approval` | `set-approval` | type と step を指定 |
| `awaiting-approval` | `active` | `clear-approval` | pendingApproval=null, pauseReason=null に |
| `rate-limited` | `active` | `set-status "active"` | resume 時の手動遷移 |
| `paused` | `active` | `set-status "active"` | resume 時の手動遷移 |

### [BUG] complete-step が status をチェック/更新しない (L72-88)

`complete-step` は `status` フィールドを一切参照しない。以下の異常な遷移が可能:

- `paused` 状態で `complete-step` を呼ぶと、status=paused のまま completed/current が更新される
- `rate-limited` 状態で `complete-step` を呼ぶと、status=rate-limited のまま進行する
- `awaiting-approval` 状態でも同様

本来は `status == "active"` の場合のみ `complete-step` を許可すべき。呼び出し元 (pipeline-runner.sh) が暗黙的にこの前提を守っているが、スクリプト自体にガードがない。

### 補足: set-status の制約なし

`set-status` は任意の from→to 遷移を許可する。例えば `completed` → `active` への遷移も制限されない。状態遷移の正当性は呼び出し元に委ねられている。

---

## 3. jq Dependencies

pipeline-state.sh 内の全 jq 呼び出しと TS 移行時の置換パターン。

| Location | jq Expression | Purpose | TS Replacement |
|---|---|---|---|
| L17-20 | `command -v jq` | jq の存在チェック | 削除 (ネイティブ JSON 処理) |
| L39 | `jq '.'` | JSON 整形して書き込み | `JSON.stringify(state, null, 2)` |
| L50 | `jq -r '.[0] // empty'` | pipeline 配列の先頭ステップ取得 | `steps[0] ?? null` |
| L51-67 | `jq -n --arg/--argjson '{...}'` | init 時の state オブジェクト構築 | オブジェクトリテラル `{ flow, variant: null, ... }` |
| L75-85 | `jq --arg $step '.completed += [$step] \| .completed \|= unique \| ...'` | complete-step: completed 追加 + current 再計算 | `completed = [...new Set([...completed, step])]`、`pipeline.find(s => !completed.includes(s)) ?? null` |
| L94-101 | `jq --arg $status '.status = $status \| .pauseReason = ...'` | set-status: status + pauseReason 更新 | プロパティ代入 |
| L110-117 | `jq --arg variant --argjson condition '.variant = ... \| .condition = ...'` | set-variant: variant + condition 設定 | プロパティ代入 |
| L126-134 | `jq --arg type --arg step '.status = "awaiting-approval" \| ...'` | set-approval: approval 状態設定 | プロパティ代入 + `pendingApproval = { type, step }` |
| L141-148 | `jq --arg now '.status = "active" \| .pendingApproval = null \| ...'` | clear-approval: approval 解除 | プロパティ代入 |
| L155-163 | `jq --argjson steps '.pipeline = $steps \| ... .[0] // null ...'` | set-pipeline: pipeline 置換 + current 再計算 | `pipeline = steps`、complete-step と同じ current 計算ロジック |

### jq パターンの分類

1. **構築パターン** (init): `jq -n` でゼロからオブジェクト生成 → TS ではオブジェクトリテラル
2. **更新パターン** (set-status, set-variant, set-approval, clear-approval): 単純プロパティ上書き → TS ではスプレッド演算子 or 直接代入
3. **計算パターン** (complete-step, set-pipeline): 配列操作 + フィルタリング → TS では `Array.filter()` + `Set`

---

## 4. [BUG] markers

### BUG-1: complete-step が status をチェックしない (L72-88)

**影響**: `paused`/`rate-limited`/`awaiting-approval` 状態でステップを進行させることが可能。
**根本原因**: complete-step は completed/current/updated のみ操作し、status フィールドを参照しない。
**現在の緩和策**: 呼び出し元 (pipeline-runner.sh) が暗黙的に active 状態でのみ呼ぶ。
**TS 移行時の修正**: `if (state.status !== 'active') throw new Error(...)` ガードを追加。

### BUG-2: ステップ名のバリデーションなし (L72-88)

**影響**: `complete-step "nonexistent-step"` を呼ぶと、pipeline 配列に存在しないステップが completed に追加される。
**根本原因**: completed への追加時に `pipeline` 配列との突き合わせがない。
**リスク**: 低 (呼び出し元が正しいステップ名を渡す前提)。ただし typo 時のデバッグが困難。
**TS 移行時の修正**: `if (!state.pipeline.includes(step)) throw new Error(...)` ガードを追加。

### BUG-3: ファイルロックなし (全サブコマンド)

**影響**: 複数プロセスが同時に pipeline-state.sh を呼ぶと、read→modify→write の間にデータが上書きされる可能性。
**根本原因**: `read_state()` → jq 変換 → `write_state()` がアトミックでない。
**現在の緩和策**: pipeline-runner.sh は基本的にシーケンシャルにステップを実行するため、実害は少ない。ただし review-runner のバックグラウンド実行時に retry-helpers.sh が `retries` を直接書き込む場合は競合の可能性あり。
**TS 移行時の修正**: `fs.writeFileSync` + ファイルロック (e.g., `proper-lockfile`) or 排他制御。

### BUG-4: implement_phases_completed が pipeline-state.sh で管理されていない

**影響**: `pipeline-state.json` の一部フィールドが pipeline-state.sh の抽象化を迂回して直接操作される。
**根本原因**: implement フェーズ分割機能が pipeline-state.sh の設計後に追加され、サブコマンドが追加されなかった。
**関連箇所**:
  - `pipeline-runner.sh` L377-381: 書き込み
  - `pipeline-runner.sh` L407, L642: 読み取り
**TS 移行時の修正**: `completePhase(phase: string)` / `getCompletedPhases()` メソッドを追加。

### BUG-5: retries が pipeline-state.sh で管理されていない

**影響**: BUG-4 と同様、抽象化の迂回。
**根本原因**: retry 機能が retry-helpers.sh に実装され、pipeline-state.sh にサブコマンドが追加されなかった。
**関連箇所**: `retry-helpers.sh` L184
**TS 移行時の修正**: `logRetry(record: RetryRecord)` メソッドを追加。

---

## 5. [CONTRACT] markers

- **`[CONTRACT: PipelineState]`** -- ファイル全体がこの型を管理する。contracts.md Section 1 の `PipelineState` インターフェースに対応。

### contracts.md との対応

| contracts.md セクション | pipeline-state.sh の対応 |
|---|---|
| PipelineState interface (L13-27) | init サブコマンドで全フィールドを初期化 (optional フィールド除く) |
| PipelineStatus type (L29) | set-status で設定 (バリデーションなし) |
| PendingApproval interface (L31-34) | set-approval / clear-approval で操作 |
| RetryRecord interface (L36-42) | **未対応** -- retry-helpers.sh が直接管理 |
| サブコマンド入出力表 (L47-56) | 全サブコマンドが一致。入出力仕様は正確 |

---

## 6. [KEEP-BASH] boundaries

### pipeline-state.sh 自体の移行

このファイルは TS 移行対象。移行後は `dist/pipeline-state.js` として動作する。

### 呼び出し元との互換性維持パターン

TS 移行後、2つの呼び出しパターンで互換性を維持する:

#### パターン A: TS からの直接 import (pipeline-runner.ts)

```typescript
import { initState, completeStep, setStatus, setVariant, setApproval, clearApproval, setPipeline } from './pipeline-state.js';
```

pipeline-runner.sh も TS 移行対象のため、移行後は直接 import する。

#### パターン B: bash ラッパー経由 ([KEEP-BASH] スクリプト群)

以下の [KEEP-BASH] スクリプトは bash のまま残り、薄いラッパー経由で呼び出す:

- `intake-and-specify.sh` (L112, L122, L194, L216 の 4 箇所)
- `resume-pipeline.sh` (L59 の 1 箇所)
- `apply-clarifications.sh` (L71-72 の 1 箇所)

ラッパーの実装:
```bash
#!/usr/bin/env bash
# lib/pipeline-state.sh (移行後)
exec node "$(dirname "$0")/../dist/pipeline-state.js" "$@"
```

これにより、bash 側は `bash "$SCRIPT_DIR/pipeline-state.sh" <subcmd> ...` の呼び出しを一切変更せずに済む。

### 移行時の注意

- `retry-helpers.sh` の `log_retry_attempt` (L151-186) も pipeline-state.json を直接操作するため、TS 側に `logRetry` API を追加し、bash ラッパー経由で呼べるサブコマンド `log-retry` を新設する必要がある
- `pipeline-runner.sh` の `implement_phases_completed` 直接操作 (L377-381, L407, L642) は pipeline-runner.ts 移行時に `pipeline-state.ts` の API に統合する

---

## 7. 呼び出し元一覧

`pipeline-state.sh` を呼び出している全箇所 (サブコマンド別):

| 呼び出し元 | サブコマンド | 行番号 | コンテキスト |
|---|---|---|---|
| `intake-and-specify.sh` | `init` | L112 | パイプライン初期化 |
| `intake-and-specify.sh` | `complete-step "specify"` | L122, L216 | specify ステップ完了 |
| `intake-and-specify.sh` | `set-status "rate-limited"` | L194 | specify 時のレートリミット |
| `pipeline-runner.sh` | `init` | L587 | パイプライン再初期化 |
| `pipeline-runner.sh` | `clear-approval` | L132 | approval 解除 (resume 時) |
| `pipeline-runner.sh` | `complete-step` | L658, L708, L981 | 各ステップ完了 |
| `pipeline-runner.sh` | `set-status "completed"` | L608, L1031 | パイプライン完了 |
| `pipeline-runner.sh` | `set-status "rate-limited"` | L510, L696, L820 | レートリミット発生 |
| `pipeline-runner.sh` | `set-status "paused"` | L699, L906, L933, L953 | NO-GO/reclassify/CONTINUE |
| `pipeline-runner.sh` | `set-variant` | L910, L916, L927, L932 | bugfix-small/large, discovery-rebuild/continue |
| `pipeline-runner.sh` | `set-pipeline` | L911, L917, L928 | パイプライン差し替え |
| `pipeline-runner.sh` | `set-approval "clarification"` | L997 | clarification 要求 |
| `pipeline-runner.sh` | `set-approval "gate"` | L1013 | gate 承認要求 |
| `resume-pipeline.sh` | `clear-approval` | L59 | resume 時の approval 解除 |
| `apply-clarifications.sh` | `clear-approval` | L71-72 | clarification 適用後の approval 解除 |

### 直接 jq 操作 (pipeline-state.sh を迂回)

| 呼び出し元 | フィールド | 行番号 | 操作 |
|---|---|---|---|
| `pipeline-runner.sh` | `implement_phases_completed` | L379 | 追加 (jq 直接) |
| `pipeline-runner.sh` | `implement_phases_completed` | L407, L642 | 読み取り (jq 直接) |
| `retry-helpers.sh` | `retries` | L184 | 追加 (jq 直接) |
