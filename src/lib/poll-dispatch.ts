/**
 * poll-dispatch.ts
 *
 * poll-dispatch.sh の TypeScript 移植。
 * 子プロセスを起動し、出力を監視しながらタイムアウトと完了を制御する。
 *
 * 主な変更点:
 * - bash の polling loop (kill -0 + sleep) → Node.js イベント駆動 + setTimeout
 * - inotifywait → proc.stdout/stderr の 'data' イベント
 * - 一時コマンドファイル不要 → SpawnSpec でコマンドを直接受け取る
 * - output_file への書き込みはオプション (review-runner.ts 互換性用)
 *
 * code-trace-p2p4.md §5 参照。
 */

import { spawn } from "node:child_process";
import fs from "node:fs";

// --- 型定義 ---

export type TimeoutType = "none" | "idle" | "max";

export interface PollResult {
  exitCode: number;
  elapsed: number;
  timeoutType: TimeoutType;
  verdict: string | null;
  errors: string[];
  clarifications: string[];
}

/**
 * 子プロセスの起動仕様。
 * dispatch-step.ts が組み立てて pollDispatch に渡す。
 */
export interface SpawnSpec {
  /** コマンド名 (例: "opencode", "claude") */
  cmd: string;
  /** コマンド引数 */
  args: string[];
  /** 作業ディレクトリ */
  cwd: string;
  /**
   * stdin に書き込む文字列 (claude CLI 用)。
   * undefined の場合は stdin を閉じる (opencode 用)。
   */
  stdinContent?: string;
  /**
   * 生の出力を書き込むファイルパス。
   * 指定すると review-runner.ts がペルソナ出力を検索できる。
   * 省略可。
   */
  outputFile?: string;
}

export interface PollOptions {
  /** アイドルタイムアウト秒数 (デフォルト 120) */
  idleTimeout?: number;
  /** 最大タイムアウト秒数 (デフォルト 600) */
  maxTimeout?: number;
  /** ステップ名 (ログ・heartbeat 用) */
  stepName?: string;
  /**
   * 結果 JSON の書き込み先ファイルパス。
   * poll-dispatch.sh の $7 引数 (RESULT_FILE) に相当。
   */
  resultFile?: string;
  /**
   * Heartbeat コールバック。
   * RESULT_FILE 指定時に 15 秒間隔で呼ばれる (poll-dispatch.sh L77-80)。
   */
  onHeartbeat?: (info: { step: string; elapsed: number; outputBytes: number }) => void;
  /** Progress マーカー検出コールバック */
  onProgress?: (marker: string) => void;
}

// --- 抽出ヘルパー ---

/**
 * 出力末尾 80 行から VERDICT を抽出する。
 * poll-dispatch.sh L147 に対応:
 *   tail -80 | grep -oP '^v: \K(GO|CONDITIONAL|NO-GO)' | tail -1
 */
export function extractVerdict(output: string): string | null {
  const lines = output.split("\n").slice(-80);
  let lastMatch: string | null = null;
  for (const line of lines) {
    const m = line.match(/^v: (GO|CONDITIONAL|NO-GO)/);
    if (m) lastMatch = m[1] ?? null;
  }
  return lastMatch;
}

/**
 * [ERROR: ...] 形式のエラーを抽出する。
 * テンプレートのプレースホルダーを除外する。
 * poll-dispatch.sh L152-159 に対応。
 */
export function extractErrors(output: string): string[] {
  const matches = [...output.matchAll(/\[ERROR: [^\]]*\]/g)].map((m) => m[0]);
  return matches.filter(
    (s) => !/<[^>]+>/.test(s) && s !== "[ERROR: description]"
  );
}

/**
 * [NEEDS CLARIFICATION: ...] を抽出する。
 * poll-dispatch.sh L162-169 に対応。
 */
export function extractClarifications(output: string): string[] {
  const matches = [...output.matchAll(/\[NEEDS CLARIFICATION: [^\]]*\]/g)].map(
    (m) => m[0]
  );
  return matches.filter(
    (s) =>
      !/<[^>]+>/.test(s) && s !== "[NEEDS CLARIFICATION: question]"
  );
}

// --- pollDispatch ---

/**
 * 子プロセスを起動し、完了・タイムアウトを監視して PollResult を返す。
 *
 * タイムアウト戦略 (code-trace-p2p4.md §5-4):
 *   - none: 正常完了 or opencode 完了シグナル後の grace kill
 *   - idle: OUTPUT_STARTED=true かつ出力なし N 秒 → exitCode=124
 *   - max:  経過時間 >= maxTimeout → exitCode=124
 *
 * opencode 完了シグナル (code-trace-p2p4.md §5-2, §9-2):
 *   '"type":"step_finish".*"reason":"stop"' を検出後、最大 10 秒 grace を与え
 *   プロセスを自然終了待ち → 10 秒経過で SIGTERM → exitCode=0 として扱う。
 */
export async function pollDispatch(
  spec: SpawnSpec,
  opts: PollOptions = {}
): Promise<PollResult> {
  const idleTimeoutMs = (opts.idleTimeout ?? 120) * 1000;
  const maxTimeoutMs = (opts.maxTimeout ?? 600) * 1000;
  const stepName = opts.stepName ?? "unknown";

  // CLAUDECODE を環境変数から除去 (code-trace-p2p4.md §9-3)
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.CLAUDECODE;

  // 出力ファイルストリーム (省略可)
  let outputStream: fs.WriteStream | null = null;
  if (spec.outputFile) {
    outputStream = fs.createWriteStream(spec.outputFile, { flags: "w" });
  }

  const proc = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    env,
    stdio:
      spec.stdinContent !== undefined
        ? ["pipe", "pipe", "pipe"]
        : ["ignore", "pipe", "pipe"],
  });

  // stdin 書き込み (claude CLI 用)
  if (spec.stdinContent !== undefined && proc.stdin) {
    proc.stdin.write(spec.stdinContent, "utf8");
    proc.stdin.end();
  }

  const startTime = Date.now();

  // 監視状態
  const state = {
    rawOutput: "",
    outputStarted: false,
    lastDataTime: startTime,
    completionDetected: false,
    lastHbTime: startTime,
  };

  // 終了情報 (Promise 外で設定し、close イベントで読む)
  let timeoutType: TimeoutType = "none";
  let processExitCode = 0;
  let wasKilledByGrace = false;

  await new Promise<void>((resolve) => {
    let settled = false;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let hbInterval: ReturnType<typeof setInterval> | null = null;

    function clearAllTimers() {
      if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
      if (hbInterval) { clearInterval(hbInterval); hbInterval = null; }
    }

    /**
     * プロセスを SIGTERM で停止する。
     * close イベントが発火して resolve() が呼ばれる。
     */
    function killProcess(tt: TimeoutType) {
      if (settled) return;
      timeoutType = tt;
      clearAllTimers();
      proc.kill("SIGTERM");
    }

    /**
     * Idle タイマーをリセットする。
     * outputStarted になるまでは起動しない (poll-dispatch.sh §5-2)。
     */
    function resetIdleTimer() {
      if (!state.outputStarted) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => killProcess("idle"), idleTimeoutMs);
    }

    /**
     * opencode 完了シグナル検出後に grace タイマーを起動する。
     * idle/max タイマーを停止し、10 秒後に自然終了を促す。
     */
    function activateGrace() {
      if (graceTimer) return; // 既に起動済み
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
      graceTimer = setTimeout(() => {
        wasKilledByGrace = true;
        killProcess("none");
      }, 10000);
    }

    function onData(chunk: Buffer) {
      const str = chunk.toString();
      state.rawOutput += str;
      outputStream?.write(chunk);
      state.lastDataTime = Date.now();
      state.outputStarted = true;

      // idle タイマーをリセット
      resetIdleTimer();

      // Progress マーカー抽出
      for (const m of str.matchAll(
        /\[(PROGRESS|REVIEW-PROGRESS): [^\]]*\]/g
      )) {
        opts.onProgress?.(m[0]);
      }

      // opencode 完了シグナル検出 (code-trace-p2p4.md §5-2, §9-2)
      if (
        !state.completionDetected &&
        str.includes('"type":"step_finish"') &&
        str.includes('"reason":"stop"')
      ) {
        state.completionDetected = true;
        activateGrace();
      }
    }

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    // close イベント: 全 stdio が閉じた後に発火 (exit より信頼性高)
    proc.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearAllTimers();

      if (timeoutType !== "none") {
        // idle / max タイムアウト: 標準 timeout exit code
        processExitCode = 124;
      } else if (wasKilledByGrace) {
        // opencode 完了シグナル後の grace kill: 成功扱い (bash と同じ)
        processExitCode = 0;
      } else if (signal !== null && signal !== "SIGTERM") {
        // 予期しないシグナルで終了
        processExitCode = 1;
      } else {
        processExitCode = code ?? 0;
      }

      // outputStream をフラッシュしてから resolve
      if (outputStream) {
        let streamResolved = false;
        const done = () => {
          if (!streamResolved) {
            streamResolved = true;
            resolve();
          }
        };
        outputStream.once("finish", done);
        outputStream.once("error", done);
        outputStream.end();
      } else {
        resolve();
      }
    });

    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearAllTimers();
      processExitCode = 1;
      const errMsg = `[spawn error: ${err.message}]`;
      state.rawOutput += `\n${errMsg}`;
      outputStream?.write(errMsg);

      if (outputStream) {
        let streamResolved = false;
        const done = () => {
          if (!streamResolved) {
            streamResolved = true;
            resolve();
          }
        };
        outputStream.once("finish", done);
        outputStream.once("error", done);
        outputStream.end();
      } else {
        resolve();
      }
    });

    // max タイムアウト
    maxTimer = setTimeout(() => killProcess("max"), maxTimeoutMs);

    // Heartbeat (RESULT_FILE 指定時、15 秒間隔)
    if (opts.resultFile || opts.onHeartbeat) {
      hbInterval = setInterval(() => {
        if (settled) return;
        const now = Date.now();
        if (now - state.lastHbTime >= 15000) {
          state.lastHbTime = now;
          opts.onHeartbeat?.({
            step: stepName,
            elapsed: Math.round((now - startTime) / 1000),
            outputBytes: state.rawOutput.length,
          });
        }
      }, 5000);
    }
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const result: PollResult = {
    exitCode: processExitCode,
    elapsed,
    timeoutType,
    verdict: extractVerdict(state.rawOutput),
    errors: extractErrors(state.rawOutput),
    clarifications: extractClarifications(state.rawOutput),
  };

  if (opts.resultFile) {
    try {
      fs.writeFileSync(opts.resultFile, JSON.stringify(result), "utf8");
    } catch {
      // 書き込み失敗は無視 (bash と同じ挙動)
    }
  }

  return result;
}
