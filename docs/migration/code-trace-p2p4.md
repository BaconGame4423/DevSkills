# コードフロー・副作用トレース — P2残り + P3

> 作成: 2026-02-19
> 対象: P2残り (review-setup.sh, review-aggregate.sh, review-log-update.sh), P3 (dispatch-step.sh, poll-dispatch.sh)
> 前提: code-trace.md (P1/P2コア移植分) 参照済み
> 目的: TypeScript 移植 (Task #3 review-setup/aggregate/log-update, Task #4 dispatch-step/poll-dispatch) の設計参照資料

---

## 目次

1. [review-setup.sh — レビュー初期化](#1-review-setupsh--レビュー初期化)
2. [review-aggregate.sh — 集約・重複排除](#2-review-aggregatesh--集約重複排除)
3. [review-log-update.sh — YAML 追記](#3-review-log-updatesh--yaml-追記)
4. [dispatch-step.sh — ディスパッチラッパー](#4-dispatch-stepsh--ディスパッチラッパー)
5. [poll-dispatch.sh — プロセス監視ループ](#5-poll-dispatchsh--プロセス監視ループ)
6. [P1移植済みコードからの呼び出しパス](#6-p1移植済みコードからの呼び出しパス)
7. [副作用マップ (P2残り + P3)](#7-副作用マップ-p2残り--p3)
8. [インターフェース要件](#8-インターフェース要件)
9. [移植時の注意点・落とし穴](#9-移植時の注意点落とし穴)

---

## 1. review-setup.sh — レビュー初期化

### 1-1. 入出力仕様

```
入力引数:
  --type        : planreview | tasksreview | architecturereview | qualityreview | phasereview
  --target      : レビュー対象ファイル or ディレクトリ
  --feature-dir : フィーチャーディレクトリ (PROJECT_DIR からの相対パス)
  --project-dir : プロジェクトルート

stdout: JSON {
  depth: "light" | "standard" | "deep",
  max_iterations: 2 | 3 | 5,
  next_id: N,
  log_path: "$FD/review-log-{type}.yaml",
  id_prefix: "PR" | "TR" | "AR" | "QR" | "PH",
  review_type: string,
  personas: [{ name, cli, model, agent_name }],
  fixer: { cli, model, agent_name: "review-fixer" }
}
```

### 1-2. ペルソナ解決フロー (L49–92)

```
get_personas($REVIEW_TYPE) → スペース区切り文字列:
  planreview       → "planreview-pm planreview-critical planreview-risk planreview-value"
  tasksreview      → "tasksreview-junior tasksreview-senior tasksreview-techlead tasksreview-devops"
  architecturereview → "architecturereview-architect architecturereview-performance architecturereview-security architecturereview-sre"
  qualityreview    → "qualityreview-code qualityreview-qa qualityreview-security qualityreview-testdesign"
  phasereview      → "phasereview-qa phasereview-ux phasereview-regression phasereview-docs"

for persona in $PERSONAS:
  config-resolver.sh $persona $CONFIG_PATH → {cli, model}
  フォールバック: {"cli":"claude","model":"sonnet"} (2>/dev/null || echo)
  PERSONAS_JSON に追記 (jq でアキュムレート)

fixer も同様に config-resolver.sh "fixer" で解決
```

### 1-3. 深度計算フロー (L99–138)

```
初期値: DEPTH="standard", MAX_ITERATIONS=3

TARGET がディレクトリ:
  find で実装ファイル (html|js|ts|css|py) の行数合計 → TOTAL_CHANGES
  ファイル数カウント → FILES_CHANGED

TARGET がファイル:
  git diff --stat HEAD → DIFF_STATS
  insertions + deletions → TOTAL_CHANGES
  files changed → FILES_CHANGED

深度判定:
  TOTAL_CHANGES > 500 OR FILES_CHANGED > 20 → DEPTH="deep",   MAX_ITERATIONS=5
  TOTAL_CHANGES < 50 AND FILES_CHANGED <  5 → DEPTH="light",  MAX_ITERATIONS=2
  それ以外                                  → DEPTH="standard", MAX_ITERATIONS=3

設定ファイルで上書き可能:
  config.review_depth != "auto" → DEPTH=config値, MAX_ITERATIONS を対応値に変更
  (deep→5, standard→3, light→2)
```

### 1-4. ログパス初期化と NEXT_ID 計算 (L140–159)

```
LOG_PATH = "$FD/review-log-${REVIEW_TYPE}.yaml"
NEXT_ID = 1

LOG_PATH が存在する場合:
  grep -oP '[A-Z]+(\d+)' で全 ID 数値部分を抽出
  sort -n | tail -1 → MAX_ID
  NEXT_ID = MAX_ID + 1

ID プレフィックス対応表:
  planreview          → "PR"
  tasksreview         → "TR"
  architecturereview  → "AR"
  qualityreview       → "QR"
  phasereview         → "PH"
  (default)           → "RV"
```

### 1-5. 副作用

| 操作 | 詳細 | リスク |
|---|---|---|
| `config-resolver.sh` 実行 (N+1回) | ペルソナ数+fixer 分の外部プロセス起動 | パフォーマンス (移植で内部化推奨) |
| `git diff --stat HEAD` | 読み取りのみ | なし |
| `find` コマンド | 読み取りのみ | なし |
| **ファイル書き込みなし** | stdout のみ | — |

---

## 2. review-aggregate.sh — 集約・重複排除

### 2-1. 入出力仕様

```
入力引数:
  --output-dir  : ペルソナ出力ファイルのディレクトリ (*.txt, *.json)
  --log         : review-log.yaml のパス (固定済み issue ID 取得用)
  --id-prefix   : "PR" | "TR" | etc.
  --next-id     : 採番開始番号
  --review-type : レビュー種別 (issues ファイル名の suffix に使用)

stdout: JSON {
  total: N, C: N, H: N, M: N, L: N,
  next_id: N,
  issues_file: "$FD/review-issues-{type}.txt" | "/tmp/...",
  converged: true|false,
  verdicts: "persona:VERDICT ..."
}

副産物ファイル:
  $FD/review-issues-{review_type}.txt  ← 安定パス (--log あり, --review-type あり)
  $FD/review-issues-latest.txt          ← 互換性のため常に更新
```

### 2-2. 集約フロー (L46–131)

```
[Phase A: 修正済み issue 収集] (L46–66)
  --log が存在する場合:
    review-log.yaml を行ごとに読み込み
    "fixed:" キーワードで IN_FIXED_BLOCK=true
    "  - ID形式" の行 (正規表現: ^[[:space:]]*-[[:space:]]*([A-Z]+[0-9]+)) → FIXED_ISSUES[ID]=1
    非リスト行で IN_FIXED_BLOCK=false にリセット

[Phase B: ペルソナ出力パース] (L68–131)
  for each file in $OUTPUT_DIR/*.txt and *.json:
    ファイル名から PERSONA_NAME を抽出 (拡張子除去)

    コンテンツ抽出優先順位:
      1. jq -r 'select(.type=="text") | .part.text // empty' (opencode JSON 形式)
      2. fallback: cat (plaintext 形式)

    VERDICT 抽出:
      grep -oP '^VERDICT:\s*\K(GO|CONDITIONAL|NO-GO)'
      → VERDICTS 文字列に "persona:VERDICT " を追記

    ISSUE 行パース:
      正規表現: ^ISSUE:[[:space:]]*(C|H|M|L)[[:space:]]*\|[[:space:]]*(.*)\|[[:space:]]*(.*)
      → SEVERITY, DESCRIPTION, LOCATION 抽出

      [Dedup 1: Fixed-issue]
        FIXED_ISSUES[ID] が存在 → SKIP=true (現在 ID ベース dedup は未実装: 注意*)

      [Dedup 2: Cross-persona location 重複]
        ISSUES_FILE の 4列目 (location) に同値があれば → SKIP=true

      SKIP=false の場合:
        ISSUE_ID = ID_PREFIX + zero-pad(NEXT_ID, 3)
        NEXT_ID++
        echo "${ISSUE_ID}|${SEVERITY}|${DESCRIPTION}|${LOCATION}|${PERSONA_NAME}" >> $ISSUES_FILE
        COUNT_C/H/M/L/TOTAL 更新
```

> **注意***: Dedup 1 は FIXED_ISSUES を参照するが、SKIP 判定コードが空のため現在は location ベース (Dedup 2) のみ有効。ID ベース dedup は review-log に location 情報が保存されるようになった後に実装予定 (コメント L104-106)。

### 2-3. 収束判定 (L133–138)

```
CONVERGED = true  ← COUNT_C == 0 AND COUNT_H == 0
CONVERGED = false ← それ以外
```

### 2-4. issues ファイル保存 (L149–161)

```
--log あり の場合:
  STABLE_ISSUES = dirname($LOG_PATH)/review-issues-${REVIEW_TYPE}.txt
  cp $ISSUES_FILE $STABLE_ISSUES
  cp $ISSUES_FILE dirname($LOG_PATH)/review-issues-latest.txt

--log なし の場合:
  issues_file = ISSUES_FILE (mktemp の一時パス) ← EXIT trap で削除される点に注意
```

### 2-5. 副作用

| 操作 | 詳細 | リスク |
|---|---|---|
| `mktemp` | /tmp に一時ファイル作成 | EXIT trap で削除 |
| `review-issues-{type}.txt` 書き込み | `$FD` 配下の issues ファイルを上書き | 毎イテレーション上書き (前回内容消去) |
| `review-issues-latest.txt` 書き込み | 同上 | 同上 |

---

## 3. review-log-update.sh — YAML 追記

### 3-1. 入出力仕様

```
入力引数:
  --log          : review-log.yaml のパス (必須)
  --issues-file  : issues テキストファイルのパス
  --verdicts     : "persona1:GO persona2:CONDITIONAL ..." 文字列
  --iteration    : N (必須)
  --fixed        : "ID1,ID2,..." カンマ区切り (省略可)

stdout: LOG_PATH (更新されたファイルパス)
副産物: review-log.yaml に iteration ブロックを追記
```

### 3-2. ログ初期化 (L39–49)

```
LOG_PATH が存在しない場合:
  mkdir -p dirname($LOG_PATH)
  新規作成:
    # Review Log
    # Auto-generated by review-runner.sh
    created: $NOW
    iterations:
```

### 3-3. Legacy ログ fixup (L51–55)

```
"iterations: []" という行が存在する場合:
  sed -i で "iterations:" に置換
  (jq の null 配列が [] になるケースの互換対応)
```

### 3-4. YAML 追記フォーマット (L57–88)

```yaml
# 追記される iteration ブロック構造:

  - iteration: N
    timestamp: "2026-02-19T12:00:00Z"
    verdicts: "persona1:GO persona2:CONDITIONAL"
    issues:                     # issues-file が存在し非空の場合
      - id: PR001
        severity: H
        description: "説明テキスト"
        location: "src/foo.ts:42"
        persona: qualityreview-code
    issues: []                  # issues-file が存在しない場合
    fixed:                      # --fixed が指定された場合のみ追記
      - PR001
      - PR002
```

### 3-5. 副作用

| 操作 | 詳細 | リスク |
|---|---|---|
| `review-log.yaml` 追記 (`>>`) | ヒアドキュメント方式で末尾に追記 | **アトミックでない** (追記途中のクラッシュでログ破損可能性) |
| `sed -i` | Legacy fixup (一度のみ) | ファイル変更 |
| `mkdir -p` | ログディレクトリ作成 | なし |

---

## 4. dispatch-step.sh — ディスパッチラッパー

### 4-1. 入出力仕様

```
引数 (位置引数):
  $1: STEP          (例: "specify", "planreview-pm", "fixer")
  $2: PROJECT_DIR   (絶対パスに解決)
  $3: PROMPT_FILE   (絶対パスに解決)
  $4: IDLE_TIMEOUT  (デフォルト: 120)
  $5: MAX_TIMEOUT   (デフォルト: 600)
  $6: RESULT_FILE   (省略可: 指定時は poll-dispatch がファイルに出力)

stdout: poll-dispatch.sh の JSON サマリーをそのまま透過 (RESULT_FILE 非指定時)
        RESULT_FILE 指定時: heartbeat JSONL を透過 (サマリーは RESULT_FILE に)
exit code: poll-dispatch.sh の exit code をそのまま透過
```

### 4-2. 実行フロー (L22–90)

```
1. パス解決
   PROJECT_DIR = "$(cd "$PROJECT_DIR" && pwd)" (realpath)
   PROMPT_FILE = "$(cd dirname && pwd)/basename" (realpath)

2. バリデーション
   PROJECT_DIR が存在しない → JSON エラーを stderr に出力 && exit 1
   PROMPT_FILE が存在しない → JSON エラーを stderr に出力 && exit 1

3. config-resolver.sh で CLI/model 解決
   CONFIG_PATH = "$PROJECT_DIR/.poor-dev/config.json" (存在しなければ空)
   RESOLVED = config-resolver.sh $STEP [$CONFIG_PATH]
   CLI = jq -r '.cli'
   MODEL = jq -r '.model'
   CLI が空 or null → JSON エラー && exit 1

4. コマンドファイル生成 (/tmp/poor-dev-cmd-{STEP}-$$.sh)
   CLI == "opencode":
     cd "$PROJECT_DIR" && opencode run --model "$MODEL" --format json "$(cat "$PROMPT_FILE")"
   CLI == "claude":
     cd "$PROJECT_DIR" && cat "$PROMPT_FILE" | env -u CLAUDECODE claude -p \
       --model "$MODEL" --no-session-persistence \
       --output-format text --dangerously-skip-permissions
   その他 → JSON エラー && exit 1
   chmod +x $CMD_FILE

5. poll-dispatch.sh 実行
   bash poll-dispatch.sh $CMD_FILE $OUTPUT_FILE $PROGRESS_FILE \
     $IDLE_TIMEOUT $MAX_TIMEOUT $STEP $RESULT_FILE
   EXIT_CODE=$?

6. クリーンアップ
   rm -f $CMD_FILE
   exit $EXIT_CODE
```

### 4-3. 生成される一時ファイル

| ファイル | パターン | クリーンアップタイミング |
|---|---|---|
| コマンドファイル | `/tmp/poor-dev-cmd-{STEP}-$$.sh` | poll-dispatch 完了後に rm -f |
| 出力ファイル | `/tmp/poor-dev-output-{STEP}-$$.txt` | **クリーンアップされない** (呼び出し元が使用) |
| プログレスファイル | `/tmp/poor-dev-progress-{STEP}-$$.txt` | **クリーンアップされない** |

> **注意**: output/progress ファイルは dispatch-step.sh 内でクリーンアップされない。
> review-runner.ts の `dispatchPersona` は `/tmp/poor-dev-output-{persona}-` プレフィックスで最新ファイルを検索してコピーしている (L366-376)。

### 4-4. claude CLI コマンドの重要フラグ

```
env -u CLAUDECODE    : CLAUDECODE 環境変数を除去 (ネストした claude 呼び出しを防ぐ)
claude -p            : プロンプトモード (非対話)
--no-session-persistence : セッション状態を保持しない
--output-format text : テキスト出力 (JSON でない)
--dangerously-skip-permissions : パーミッションチェックをスキップ
```

---

## 5. poll-dispatch.sh — プロセス監視ループ

### 5-1. 入出力仕様

```
引数 (位置引数):
  $1: COMMAND_FILE  (実行する bash スクリプト)
  $2: OUTPUT_FILE   (stdout/stderr のリダイレクト先)
  $3: PROGRESS_FILE (プログレスマーカー集積先)
  $4: IDLE_TIMEOUT  (デフォルト: 120s)
  $5: MAX_TIMEOUT   (デフォルト: 600s)
  $6: STEP_NAME     (デフォルト: "unknown")
  $7: RESULT_FILE   (省略可)

RESULT_FILE なし:
  stdout: JSON サマリー (1行)
RESULT_FILE あり:
  stdout: heartbeat JSONL (15秒間隔)
  RESULT_FILE: JSON サマリー

JSON サマリー構造:
  {
    "exit_code": N,
    "elapsed": N,
    "timeout_type": "none" | "idle" | "max",
    "verdict": "GO" | "CONDITIONAL" | "NO-GO" | null,
    "errors": ["[ERROR: ...]", ...],
    "clarifications": ["[NEEDS CLARIFICATION: ...]", ...]
  }
```

### 5-2. プロセス起動とポーリングループ (L44–136)

```
初期化:
  : > $OUTPUT_FILE   (ファイルをクリア/作成)
  : > $PROGRESS_FILE
  env -u CLAUDECODE bash $COMMAND_FILE > $OUTPUT_FILE 2>&1 &
  PID=$!

  HAS_INOTIFYWAIT = command -v inotifywait >/dev/null 2>&1

ポーリングループ (while kill -0 $PID):
  [待機]
    inotifywait あり: inotifywait -t 5 -e modify $OUTPUT_FILE (イベント駆動)
    なし: sleep 1 (ポーリング)

  NOW = date +%s; ELAPSED = NOW - START_TIME

  [Heartbeat] RESULT_FILE あり && 15秒経過:
    echo '{"heartbeat":true,"step":"...","elapsed":N,"output_bytes":N}'

  [出力変化検出]
    CURRENT_SIZE = wc -c < $OUTPUT_FILE
    CURRENT_SIZE > LAST_SIZE の場合:
      OUTPUT_STARTED=true, IDLE=0, LAST_IDLE_TIME=NOW

      差分バイト読み取り: tail -c +$((LAST_SIZE+1)) $OUTPUT_FILE
      [PROGRESS: ...] / [REVIEW-PROGRESS: ...] マーカーを $PROGRESS_FILE に追記
      LAST_SIZE = CURRENT_SIZE

      opencode 完了シグナル検出:
        '"type":"step_finish".*"reason":"stop"' に一致 → COMPLETION_DETECTED=true

  [opencode 完了後 10秒 grace]
    COMPLETION_DETECTED=true:
      COMPLETION_GRACE++
      COMPLETION_GRACE >= 10 or PID 終了 → kill $PID, break (TIMEOUT_TYPE="none")

  [アイドルタイムアウト]
    OUTPUT_STARTED=true && IDLE >= IDLE_TIMEOUT:
      kill $PID, TIMEOUT_TYPE="idle", break

  [最大タイムアウト]
    ELAPSED >= MAX_TIMEOUT:
      kill $PID, TIMEOUT_TYPE="max", break
```

### 5-3. 結果抽出 (L138–188)

```
EXIT_CODE:
  TIMEOUT_TYPE == "none" → wait $PID (実際の exit code)
  それ以外               → 124 (timeout 標準 exit code)

VERDICT 抽出:
  tail -80 $OUTPUT_FILE | grep -oP '^v: \K(GO|CONDITIONAL|NO-GO)' | tail -1

ERROR 抽出:
  grep -oP '\[ERROR: [^\]]*\]' $OUTPUT_FILE
  フォールバック除外:
    - '<...>' を含む (テンプレートのプレースホルダー)
    - '[ERROR: description]' (サンプルテキスト)
  jq でJSON配列化

CLARIFICATION 抽出:
  grep -oP '\[NEEDS CLARIFICATION: [^\]]*\]' $OUTPUT_FILE
  同様のフォールバック除外処理
  jq でJSON配列化

出力:
  RESULT_FILE あり → $RESULT_FILE に書き込み
  なし            → stdout に出力
```

### 5-4. タイムアウト戦略

| タイムアウト種別 | 条件 | EXIT_CODE | 意味 |
|---|---|---|---|
| `none` | 正常完了 or opencode 完了シグナル後10s | プロセス実際の値 | 成功 or 失敗 |
| `idle` | OUTPUT_STARTED=true かつ出力なし N秒 | 124 | プロセス応答なし (スタック) |
| `max` | 経過時間 >= MAX_TIMEOUT | 124 | 総時間超過 |

> **重要**: `idle` タイムアウトは `OUTPUT_STARTED=true` になってから有効。出力が始まる前はカウントされない。これにより初期化・API レートリミット待機中の誤タイムアウトを防ぐ。

### 5-5. コマンドファイルバリデーション (L33–38)

```
FIRST_CMD = grep -m1 -oE '\b(opencode|claude|cat)\b' $COMMAND_FILE
空の場合 → エラー JSON && exit 1
```

これにより任意のシェルスクリプトが実行されることを防ぐ最低限のサニタイズ。

### 5-6. 副作用

| 操作 | 詳細 | リスク |
|---|---|---|
| `env -u CLAUDECODE bash $COMMAND_FILE &` | バックグラウンドプロセス起動 | PID 管理が必要 |
| `$OUTPUT_FILE` 書き込み | コマンド出力をリダイレクト | プロセス終了まで増分 |
| `$PROGRESS_FILE` 追記 | マーカーを追記 | 累積 |
| `kill $PID` | タイムアウト時 or 完了後 | SIGTERM |
| `RESULT_FILE` 書き込み | 最終 JSON サマリー | 原子的 (echo → ファイル) |

---

## 6. P1移植済みコードからの呼び出しパス

### 6-1. review-runner.ts → P2残り Bash スクリプト

```
ReviewRunner.run()
  │
  ├── runReviewSetup() [review-runner.ts L73-111]
  │   └── execFileSync("bash", ["review-setup.sh", ...])
  │       → review-setup.sh (P2残り, 移植対象)
  │           └── config-resolver.sh × (N_personas + 1)
  │
  ├── dispatchPersona() × N_personas [Promise.allSettled]
  │   └── dispatchWithRetry() [retry-helpers.ts]
  │       └── Dispatcher.dispatch() → dispatch-step.sh (P3, 移植対象)
  │           ├── config-resolver.sh
  │           └── poll-dispatch.sh (P3, 移植対象)
  │
  ├── runReviewAggregate() [review-runner.ts L116-156]
  │   └── execFileSync("bash", ["review-aggregate.sh", ...])
  │       → review-aggregate.sh (P2残り, 移植対象)
  │
  ├── runReviewLogUpdate() [review-runner.ts L161-182]
  │   └── execFileSync("bash", ["review-log-update.sh", ...])
  │       → review-log-update.sh (P2残り, 移植対象)
  │
  └── dispatchFixer() [review-runner.ts L623-724]
      └── dispatchWithRetry() → dispatch-step.sh → poll-dispatch.sh
```

### 6-2. pipeline-runner.ts → P3 Bash スクリプト

```
PipelineRunner.run()
  │
  ├── dispatchWithRetry() [retry-helpers.ts] (通常ステップ)
  │   └── Dispatcher.dispatch() → dispatch-step.sh → poll-dispatch.sh
  │
  ├── ReviewRunner.run() (review ステップ, review_mode="bash")
  │   └── 上記 6-1 参照
  │
  └── dispatchImplementPhases() (implement フェーズ分割)
      └── dispatchWithRetry() per phase → dispatch-step.sh → poll-dispatch.sh
```

### 6-3. Dispatcher インターフェースと dispatch-step.sh の対応

```typescript
// interfaces.ts より
interface Dispatcher {
  dispatch(
    step: string,
    projectDir: string,
    promptFile: string,
    idleTimeout: number,
    maxTimeout: number,
    resultFile: string
  ): Promise<{ exitCode: number }>
}

// 実装 (node-adapters.ts の BashDispatcher) は:
// bash dispatch-step.sh $step $projectDir $promptFile $idle $max $resultFile
// を実行し、exitCode を返す
```

### 6-4. P2残り移植後の期待アーキテクチャ

現状 (review-runner.ts 内):
```
execFileSync("bash", ["review-setup.sh", ...])      ← 外部プロセス
execFileSync("bash", ["review-aggregate.sh", ...])  ← 外部プロセス
execFileSync("bash", ["review-log-update.sh", ...]) ← 外部プロセス
```

P2残り移植後の期待:
```
reviewSetup(deps)         ← TS 関数呼び出し
reviewAggregate(deps)     ← TS 関数呼び出し
reviewLogUpdate(deps)     ← TS 関数呼び出し
```

---

## 7. 副作用マップ (P2残り + P3)

### 7-1. ファイル書き込み

| スクリプト | 書き込み先 | 操作 | アトミック? |
|---|---|---|---|
| review-log-update.sh | `$FD/review-log-{type}.yaml` | `>>` 追記 | **No** |
| review-aggregate.sh | `$FD/review-issues-{type}.txt` | `cp` (上書き) | No |
| review-aggregate.sh | `$FD/review-issues-latest.txt` | `cp` (上書き) | No |
| poll-dispatch.sh | `$OUTPUT_FILE` | コマンド stdout リダイレクト | — |
| poll-dispatch.sh | `$PROGRESS_FILE` | `>>` マーカー追記 | No |
| poll-dispatch.sh | `$RESULT_FILE` | `echo $SUMMARY` | Yes (単一 write) |

### 7-2. プロセス起動

| スクリプト | 外部プロセス | 並列性 |
|---|---|---|
| review-setup.sh | config-resolver.sh × (N_personas+1) | **逐次** (for ループ) |
| dispatch-step.sh | config-resolver.sh, poll-dispatch.sh | 逐次 |
| poll-dispatch.sh | bash $COMMAND_FILE | バックグラウンド (1 PID) |

> **性能注意**: review-setup.sh が config-resolver.sh を N+1 回逐次呼び出す。TS 移植時は config 解決を一括で行うことでパフォーマンスを改善可能。

### 7-3. git 操作

P2残り・P3 の各スクリプトに git 操作は**なし**。
git 操作は pipeline-runner.sh 内の関数 (code-trace.md §6 参照) のみ。

---

## 8. インターフェース要件

### 8-1. review-setup.sh の TS 移植で必要な依存

```typescript
interface ReviewSetupDeps {
  fileSystem: {
    exists(path: string): boolean;
    readFile(path: string): string;
  };
  git: {
    diffStat(projectDir: string): string | null;  // git diff --stat HEAD
  };
  configResolver: {
    resolve(step: string, configPath?: string): { cli: string; model: string };
  };
  find?: {
    countLines(dir: string, extensions: string[]): number;  // wc -l 相当
    countFiles(dir: string, extensions: string[]): number;
  };
}
```

### 8-2. review-aggregate.sh の TS 移植で必要な依存

```typescript
interface ReviewAggregateDeps {
  fileSystem: {
    readFile(path: string): string;
    writeFile(path: string, content: string): void;
    exists(path: string): boolean;
    copyFile(src: string, dest: string): void;
    mktemp(): string;
  };
}
```

### 8-3. review-log-update.sh の TS 移植で必要な依存

```typescript
interface ReviewLogUpdateDeps {
  fileSystem: {
    exists(path: string): boolean;
    readFile(path: string): string;
    appendFile(path: string, content: string): void;  // >> 相当
    mkdirP(path: string): void;
  };
  clock: {
    nowISO(): string;  // date -u +"%Y-%m-%dT%H:%M:%SZ"
  };
}
```

### 8-4. dispatch-step.sh の TS 移植で必要な依存

```typescript
interface DispatchStepDeps {
  fileSystem: {
    exists(path: string): boolean;
    writeFile(path: string, content: string): void;
    chmod(path: string, mode: string): void;
    removeFile(path: string): void;
  };
  configResolver: {
    resolve(step: string, configPath?: string): { cli: string; model: string };
  };
  pollDispatch: PollDispatcher;  // poll-dispatch.sh の TS 実装
}
```

### 8-5. poll-dispatch.sh の TS 移植で必要な依存

```typescript
interface PollDispatchDeps {
  spawnProcess(cmd: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess;
  fileSystem: {
    writeFile(path: string, content: string): void;
    appendFile(path: string, content: string): void;
    readFileTail(path: string, bytes: number): string;
    getFileSize(path: string): number;
  };
  clock: {
    nowSeconds(): number;  // date +%s 相当
  };
  // inotifywait は Node.js の fs.watch で代替可能
}
```

---

## 9. 移植時の注意点・落とし穴

### 9-1. review-aggregate.sh — Dedup 1 の現状 (重要)

```bash
# L104-106: コメントのみで実装なし
# --- Dedup 1: Fixed-issue (ID ベース。location ベース比較は review-log に
# location 情報が保存されるようになるまで保留) ---
SKIP=false
```

**SKIP は常に false のまま**。実質 Dedup 2 (location 重複) のみが有効。
TS 移植でも現状の動作を維持し、別 issue として追跡すること。

### 9-2. poll-dispatch.sh — opencode JSON と claude text の出力形式差異

```
opencode (--format json):
  JSONL 形式。各行が {"type":"...","part":{...}} のオブジェクト
  完了シグナル: {"type":"step_finish","reason":"stop"}
  VERDICT: review-aggregate.sh が 'select(.type=="text") | .part.text' でパース

claude (--output-format text):
  プレーンテキスト
  完了シグナル: なし (プロセス終了のみ)
  VERDICT: 出力末尾の '^v: (GO|...)' 行をパース
```

**注意**: opencode の場合、プロセスが `step_finish` を出力した後 10s の grace 期間に実際のプロセス終了を待つ (L111-118)。この grace ロジックは TS 移植でも再現が必要。

### 9-3. dispatch-step.sh — CLAUDECODE 環境変数の除去

```bash
env -u CLAUDECODE bash "$COMMAND_FILE"
```

Claude Code 内から claude CLI を呼び出す際に `CLAUDECODE` 環境変数が存在すると問題が発生する。
TS 移植では `spawn()` の `env` オプションで `CLAUDECODE` を除外すること。

### 9-4. review-log-update.sh — アトミック性の欠如

ログへの `>>` 追記は非アトミック。クラッシュすると YAML が途中で壊れる可能性がある。
TS 移植では `writeFile(path, existingContent + newBlock)` でアトミック書き込みを推奨。

### 9-5. review-setup.sh — config-resolver の N+1 呼び出し

ペルソナ4体 + fixer = 5回の外部プロセス起動。
TS 移植では config 解決ロジックをインライン化し、1回の config 読み込みで全ペルソナを解決する。

### 9-6. poll-dispatch.sh — OUTPUT_FILE のクリーンアップ非対応

dispatch-step.sh は CMD_FILE のみ削除し、OUTPUT_FILE / PROGRESS_FILE は削除しない。
review-runner.ts の `dispatchPersona` (L365-376) がプレフィックスマッチで最新の OUTPUT_FILE を検索。
TS 移植では OUTPUT_FILE のパスを明示的に渡す設計に変更することを推奨。

### 9-7. review-setup.sh — NEXT_ID の正規表現パース

```bash
grep -oP '[A-Z]+(\d+)' "$LOG_PATH" | grep -oP '\d+' | sort -n | tail -1
```

全 ID パターン (`PR001`, `TR042` 等) から数値部分を抽出して最大値を取得。
TS 移植では YAML をパースして正確な ID を取得することを推奨 (フォーマット依存を排除)。

---

## 移植優先度マトリクス (P2残り + P3)

| ファイル | 複雑度 | テスト必要性 | 副作用 | 移植優先度 |
|---|---|---|---|---|
| dispatch-step.sh | 低 | 中 (CLI 分岐のみ) | 一時ファイル生成 | **高 (P3 ブロッカー)** |
| poll-dispatch.sh | 高 | **高** (タイムアウト/完了検出) | プロセス起動、ファイル書き込み | **高 (P3 ブロッカー)** |
| review-aggregate.sh | 中 | 高 (dedup ロジック) | issues ファイル上書き | 高 |
| review-setup.sh | 中 | 中 (深度計算) | なし (読み取りのみ) | 中 |
| review-log-update.sh | 低 | 低 (YAML フォーマット確認) | YAML 追記 | 低 |

---

*このドキュメントは読み取り専用調査の結果です。コードの変更は含みません。*
