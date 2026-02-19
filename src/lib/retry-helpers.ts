/**
 * retry-helpers.ts
 *
 * retry-helpers.sh の TypeScript 移植。
 * dispatch_with_retry + logRetryAttempt を提供する。
 *
 * 主な変更点:
 * - CONFIG_FILE/STATE_FILE グローバル変数 → 明示的な引数・依存注入
 * - check_rate_limit 関数 → RateLimitChecker インターフェース経由（オプション）
 * - pre_retry_hook 関数名 → 型付きコールバック
 * - sleep → Promise<void>ベースの待機
 *
 * code-trace.md §3 参照。
 */

import type { Dispatcher, PipelineStateManager } from "./interfaces.js";
import type { RetryConfig } from "./types.js";

// --- 型定義 ---

export interface RetryOptions {
  /** CONFIG_FILE から読み込んだ retry 設定 */
  config: Partial<RetryConfig>;
  /** max_retries の上書き（review-runner は 1 を渡す） */
  maxRetriesOverride?: number;
  /**
   * リトライ前に呼ばれるフック（attempt >= 2 の時のみ）。
   * _impl_phase_pre_retry() に対応。
   */
  preRetryHook?: () => Promise<void> | void;
  /**
   * レート制限カウンタ取得関数。
   * check_rate_limit() に対応。オプション。
   */
  rateLimitChecker?: () => number;
  /**
   * PipelineStateManager（log_retry_attempt 用）。
   * STATE_FILE が存在しない場合はノーオペレーション。
   */
  stateManager?: PipelineStateManager;
  stateFile?: string;
}

export interface DispatchWithRetryResult {
  exitCode: number;
  attempts: number;
}

// --- 定数 ---

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_SECONDS = 30;
const MIN_RATE_LIMIT_BACKOFF = 60;

// --- resolveRetryConfig ---

/**
 * RetryConfig を設定から解決する。
 * バリデーション（範囲チェック）込み。
 * retry-helpers.sh L42-83 に対応。
 */
export function resolveRetryConfig(
  config: Partial<RetryConfig> | undefined
): RetryConfig {
  const enabled = config?.enabled !== false;

  let maxRetries = DEFAULT_MAX_RETRIES;
  if (
    typeof config?.max_retries === "number" &&
    config.max_retries >= 0 &&
    config.max_retries <= 10
  ) {
    maxRetries = config.max_retries;
  } else if (config?.max_retries !== undefined) {
    console.warn(
      JSON.stringify({
        warning: "retry.max_retries out of range (0-10), using default 2",
      })
    );
  }

  let backoffSeconds = DEFAULT_BACKOFF_SECONDS;
  if (
    typeof config?.backoff_seconds === "number" &&
    config.backoff_seconds >= 5 &&
    config.backoff_seconds <= 300
  ) {
    backoffSeconds = config.backoff_seconds;
  } else if (config?.backoff_seconds !== undefined) {
    console.warn(
      JSON.stringify({
        warning:
          "retry.backoff_seconds out of range (5-300), using default 30",
      })
    );
  }

  return { enabled, max_retries: maxRetries, backoff_seconds: backoffSeconds };
}

// --- calcBackoff ---

/**
 * 指数バックオフ計算。
 * backoff = backoff_seconds * 2^(attempt-1)
 * rate limit 時は 2倍 & 最小 60s。
 * code-trace.md §3-2 に対応。
 */
export function calcBackoff(
  backoffSeconds: number,
  attempt: number,
  rateLimitCount: number
): number {
  let backoff = backoffSeconds * Math.pow(2, attempt - 1);
  if (rateLimitCount > 0) {
    backoff = backoff * 2;
    if (backoff < MIN_RATE_LIMIT_BACKOFF) {
      backoff = MIN_RATE_LIMIT_BACKOFF;
    }
  }
  return Math.round(backoff);
}

// --- sleep ---

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// --- dispatchWithRetry ---

/**
 * dispatch-step.sh 呼び出しをリトライでラップする。
 * retry-helpers.sh の dispatch_with_retry() に1対1で対応。
 *
 * 戻り値: 最終 exit code（0=成功）
 *
 * リトライ条件:
 * - exit 0 → 即時成功
 * - resultFile なし → 永続エラー（バリデーション失敗）→ リトライなし
 * - その他非ゼロ → リトライ可能（タイムアウト・APIエラー等）
 */
export async function dispatchWithRetry(
  step: string,
  projectDir: string,
  promptFile: string,
  idleTimeout: number,
  maxTimeout: number,
  resultFile: string,
  dispatcher: Dispatcher,
  fs: { exists(path: string): boolean; removeFile(path: string): void },
  options: RetryOptions = { config: {} }
): Promise<DispatchWithRetryResult> {
  const cfg = resolveRetryConfig(options.config);

  // max_retries_override が渡された場合は上書き
  let maxRetries = cfg.max_retries;
  if (options.maxRetriesOverride !== undefined) {
    maxRetries = options.maxRetriesOverride;
  }

  // retry disabled or max_retries=0 → 1回のみ
  if (!cfg.enabled || maxRetries === 0) {
    maxRetries = 0;
  }

  const totalAttempts = maxRetries + 1;
  let dispatchExit = 0;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    // pre-retry フック（2回目以降のみ）
    if (attempt > 1 && options.preRetryHook) {
      await options.preRetryHook();
    }

    // result_file をクリア（is_retryable 判定のため）
    fs.removeFile(resultFile);

    // ディスパッチ実行
    dispatchExit = await dispatcher.dispatch(
      step,
      projectDir,
      promptFile,
      idleTimeout,
      maxTimeout,
      resultFile
    );

    // 成功
    if (dispatchExit === 0) {
      return { exitCode: 0, attempts: attempt };
    }

    // リトライ残りなし
    if (attempt >= totalAttempts) {
      return { exitCode: dispatchExit, attempts: attempt };
    }

    // resultFile なし → 永続エラー（バリデーション失敗）→ リトライなし
    if (!fs.exists(resultFile)) {
      return { exitCode: dispatchExit, attempts: attempt };
    }

    // --- バックオフ計算 ---
    const rateLimitCount = options.rateLimitChecker?.() ?? 0;
    const backoff = calcBackoff(cfg.backoff_seconds, attempt, rateLimitCount);

    // リトライイベント出力
    console.log(
      JSON.stringify({
        step,
        status: "retry",
        attempt,
        exit_code: dispatchExit,
        backoff_seconds: backoff,
        max_attempts: totalAttempts,
      })
    );

    // log_retry_attempt: STATE_FILE が存在する場合のみ記録
    if (options.stateManager && options.stateFile) {
      try {
        options.stateManager.logRetry(
          options.stateFile,
          step,
          attempt,
          dispatchExit,
          backoff
        );
      } catch {
        // ログ書き込み失敗はノーオペレーション（元の Bash と同じ挙動）
      }
    }

    // 待機
    await sleep(backoff);
  }

  return { exitCode: dispatchExit, attempts: totalAttempts };
}
