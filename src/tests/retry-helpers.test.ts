/**
 * retry-helpers.test.ts
 *
 * resolveRetryConfig / calcBackoff / dispatchWithRetry のテスト。
 *
 * カバレッジ:
 * - resolveRetryConfig: デフォルト値、範囲バリデーション、enabled=false
 * - calcBackoff: 指数バックオフ計算、レート制限時の 2倍 + 最小 60s
 * - dispatchWithRetry:
 *   - 1回目成功で即リターン
 *   - max_retries に従いリトライ
 *   - preRetryHook は 2回目以降のみ呼ばれる
 *   - resultFile 未存在 → 永続エラー（リトライなし）
 *   - stateManager=undefined → logRetry 未呼び出し（review コンテキスト相当）
 *   - stateManager+stateFile → logRetry 呼び出し
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveRetryConfig,
  calcBackoff,
  dispatchWithRetry,
} from "../lib/retry-helpers.js";
import { makeDispatcher, makeFileSystem, makeStateManager } from "./fixtures/mocks.js";

// sleep をスキップするためフェイクタイマーを使用
// vitest の fake timers は setTimeout をモックする

// --- ヘルパー: リトライテスト用ディスパッチャー ---
// 実際の dispatch-step.sh と同様に、呼び出し時に resultFile を書き込む。
// これがないと fs.removeFile(resultFile) 後に fs.exists(resultFile)=false になり
// 「永続エラー」として即リターンしてしまう。
function makeWritingDispatcher(
  fileSystem: ReturnType<typeof makeFileSystem>,
  resultFile: string,
  exitCodes: number[]
) {
  let idx = 0;
  return {
    dispatch: vi.fn(async () => {
      const code = exitCodes[idx++] ?? 0;
      // dispatch-step.sh は常に resultFile を書き込む
      fileSystem.writeFile(resultFile, "{}");
      return code;
    }),
  };
}

describe("resolveRetryConfig", () => {
  it("設定なしでデフォルト値を返す", () => {
    const cfg = resolveRetryConfig({});
    expect(cfg.enabled).toBe(true);
    expect(cfg.max_retries).toBe(2);
    expect(cfg.backoff_seconds).toBe(30);
  });

  it("enabled=false が反映される", () => {
    const cfg = resolveRetryConfig({ enabled: false });
    expect(cfg.enabled).toBe(false);
  });

  it("max_retries が 0-10 の範囲内なら採用される", () => {
    expect(resolveRetryConfig({ max_retries: 0 }).max_retries).toBe(0);
    expect(resolveRetryConfig({ max_retries: 5 }).max_retries).toBe(5);
    expect(resolveRetryConfig({ max_retries: 10 }).max_retries).toBe(10);
  });

  it("max_retries が範囲外なら警告を出してデフォルト 2 を使用", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = resolveRetryConfig({ max_retries: 11 });
    expect(cfg.max_retries).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("retry.max_retries out of range")
    );
    warnSpy.mockRestore();
  });

  it("backoff_seconds が 5-300 の範囲内なら採用される", () => {
    expect(resolveRetryConfig({ backoff_seconds: 5 }).backoff_seconds).toBe(5);
    expect(resolveRetryConfig({ backoff_seconds: 60 }).backoff_seconds).toBe(60);
    expect(resolveRetryConfig({ backoff_seconds: 300 }).backoff_seconds).toBe(300);
  });

  it("backoff_seconds が範囲外なら警告を出してデフォルト 30 を使用", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = resolveRetryConfig({ backoff_seconds: 4 });
    expect(cfg.backoff_seconds).toBe(30);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("retry.backoff_seconds out of range")
    );
    warnSpy.mockRestore();
  });
});

describe("calcBackoff", () => {
  it("1回目: backoff_seconds * 2^0 = backoff_seconds", () => {
    expect(calcBackoff(30, 1, 0)).toBe(30);
  });

  it("2回目: backoff_seconds * 2^1 = 60", () => {
    expect(calcBackoff(30, 2, 0)).toBe(60);
  });

  it("3回目: backoff_seconds * 2^2 = 120", () => {
    expect(calcBackoff(30, 3, 0)).toBe(120);
  });

  it("レート制限時: 2倍になる", () => {
    expect(calcBackoff(30, 1, 1)).toBe(60);
  });

  it("レート制限時: 最小 60s が保証される", () => {
    // backoff=5, attempt=1 → 5*2=10 → min 60
    expect(calcBackoff(5, 1, 1)).toBe(60);
  });
});

describe("dispatchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const STEP = "specify";
  const PROJECT_DIR = "/project";
  const PROMPT_FILE = "/tmp/prompt.txt";
  const RESULT_FILE = "/tmp/result.json";

  async function runWithFakeTimers(
    promise: Promise<unknown>
  ): Promise<unknown> {
    // タイマーを即時進める（sleep をスキップ）
    const p = promise;
    await vi.runAllTimersAsync();
    return p;
  }

  it("1回目成功で attempt=1 を返す", async () => {
    const dispatcher = makeDispatcher(0);
    const fs = makeFileSystem({ [RESULT_FILE]: "{}" });

    const result = await dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: {} }
    );

    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("失敗後にリトライし、2回目成功で attempt=2 を返す", async () => {
    const fs = makeFileSystem();
    // [1, 0]: 1回目失敗(exitCode=1)、2回目成功(exitCode=0)
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 0]);

    const promise = dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { max_retries: 2, backoff_seconds: 5 } }
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(0);
    expect(result.attempts).toBe(2);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it("max_retries 回リトライしても失敗すると最終 exitCode を返す", async () => {
    const fs = makeFileSystem();
    // 常に失敗: [1, 1, 1]
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 1, 1]);

    const promise = dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { max_retries: 2, backoff_seconds: 5 } }
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(1);
    expect(result.attempts).toBe(3);  // 1 initial + 2 retries
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
  });

  it("preRetryHook は 2回目以降のみ呼ばれる（1回目はスキップ）", async () => {
    const fs = makeFileSystem();
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 0]);  // 1回目失敗 → 2回目成功
    const preRetryHook = vi.fn();

    const promise = dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { max_retries: 2, backoff_seconds: 5 }, preRetryHook }
    );

    await vi.runAllTimersAsync();
    await promise;

    // 1回目失敗後に1回だけ呼ばれる
    expect(preRetryHook).toHaveBeenCalledTimes(1);
  });

  it("resultFile 未存在 → 永続エラー（リトライなし）", async () => {
    const dispatcher = makeDispatcher(1);
    // resultFile を書かないファイルシステム（removeFile 後に exists=false）
    const fs = makeFileSystem({});

    const result = await dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { max_retries: 2, backoff_seconds: 5 } }
    );

    // リトライなしで即リターン
    expect(result.exitCode).toBe(1);
    expect(result.attempts).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("enabled=false のとき max_retries=0 に倒れて1回のみ実行", async () => {
    const dispatcher = makeDispatcher(1);  // 常に失敗
    const fs = makeFileSystem({ [RESULT_FILE]: "{}" });

    const result = await dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { enabled: false, max_retries: 3, backoff_seconds: 5 } }
    );

    expect(result.attempts).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("maxRetriesOverride で設定の max_retries を上書きできる", async () => {
    const fs = makeFileSystem();
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 1]);  // 常に失敗

    const promise = dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      { config: { max_retries: 5 }, maxRetriesOverride: 1 }
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    // override=1 → 1 initial + 1 retry = 2 attempts
    expect(result.attempts).toBe(2);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------
  // review コンテキスト: stateManager=undefined → logRetry no-op
  // ---------------------------------------------------------------

  it("stateManager 未設定のとき logRetry は呼ばれない（review コンテキスト相当）", async () => {
    // code-trace.md §3-3: review-runner サブシェルでは STATE_FILE 未設定のため
    // RetryOptions に stateManager を渡さない設計
    const fs = makeFileSystem();
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 0]);  // 失敗→成功

    const promise = dispatchWithRetry(
      "qualityreview-code", PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      {
        config: { max_retries: 1, backoff_seconds: 5 },
        // stateManager: undefined（意図的に渡さない）
      }
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.exitCode).toBe(0);
    // stateManager がないので logRetry は一切呼ばれない（型レベルで不可）
    // dispatches は 2 回（1回失敗 + 1回成功）
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it("stateManager+stateFile がある場合 logRetry が呼ばれる", async () => {
    const fs = makeFileSystem();
    const dispatcher = makeWritingDispatcher(fs, RESULT_FILE, [1, 0]);  // 失敗→成功
    const sm = makeStateManager();

    const STATE_FILE_PATH = "/project/specs/feat/pipeline-state.json";

    const promise = dispatchWithRetry(
      STEP, PROJECT_DIR, PROMPT_FILE, 120, 600, RESULT_FILE,
      dispatcher, fs,
      {
        config: { max_retries: 1, backoff_seconds: 5 },
        stateManager: sm,
        stateFile: STATE_FILE_PATH,
      }
    );

    await vi.runAllTimersAsync();
    await promise;

    expect(sm.logRetry).toHaveBeenCalledTimes(1);
    expect(sm.logRetry).toHaveBeenCalledWith(
      STATE_FILE_PATH,
      STEP,
      1,       // attempt
      1,       // exitCode
      expect.any(Number)  // backoff
    );
  });
});
