/**
 * review-runner.test.ts
 *
 * ReviewRunner のテスト。
 *
 * Task #3 で review-setup.sh / review-aggregate.sh / review-log-update.sh が
 * TypeScript 関数に移植され、review-runner.ts が execFileSync を使わなくなった。
 * そのため、これらの新 TS モジュールを vi.mock でスタブ化する方式に変更。
 *
 * カバレッジ:
 * - ReviewRunner の構築とインターフェース準拠
 * - setupReview 失敗時 → verdict=NO-GO, exitCode=1
 * - 全ペルソナ失敗時 → exitCode=3（rate-limit）
 * - 収束チェック → GO / CONDITIONAL / NO-GO
 * - dispatchWithRetry に maxRetriesOverride=1 が渡されること（review は 1 retry のみ）
 * - stateManager が RetryOptions に含まれないこと（logRetry no-op 保証）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReviewRunner } from "../lib/review-runner.js";
import type { ReviewRunnerDeps } from "../lib/review-runner.js";
import { makeDispatcher, makeFileSystem } from "./fixtures/mocks.js";
import * as nodeFs from "node:fs";

// --- 新 TS モジュールを vi.mock でスタブ化 ---
// Task #3 で外部 bash 呼び出しが廃止された。

vi.mock("../lib/review-setup.js", () => ({
  setupReview: vi.fn(),
}));

vi.mock("../lib/review-aggregate.js", () => ({
  aggregateReviews: vi.fn(),
}));

vi.mock("../lib/review-log-update.js", () => ({
  updateReviewLog: vi.fn(),
}));

// execFileSync は compose-prompt.sh (まだ bash) のみ使用
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

// --- dispatchWithRetry をスパイ (call-through) ---
// RetryOptions に stateManager が渡されないことを検証するため

vi.mock("../lib/retry-helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/retry-helpers.js")>();
  return {
    ...actual,
    dispatchWithRetry: vi.fn(actual.dispatchWithRetry),
  };
});

import { execFileSync } from "node:child_process";
import { dispatchWithRetry } from "../lib/retry-helpers.js";
import { setupReview } from "../lib/review-setup.js";
import { aggregateReviews } from "../lib/review-aggregate.js";
const mockedExecFileSync = vi.mocked(execFileSync);
const dispatchWithRetrySpy = vi.mocked(dispatchWithRetry);
const mockedSetupReview = vi.mocked(setupReview);
const mockedAggregateReviews = vi.mocked(aggregateReviews);

// --- デフォルトモック返値 ---

function makeDefaultSetup(overrides?: object) {
  return {
    depth: "standard",
    maxIterations: 2,
    nextId: 1,
    logPath: "/tmp/review-log-qualityreview.yaml",
    idPrefix: "QR",
    reviewType: "qualityreview",
    personas: [
      { name: "qualityreview-code", cli: "claude", model: "claude-sonnet-4-6", agentName: "qualityreview-code" },
      { name: "qualityreview-security", cli: "claude", model: "claude-sonnet-4-6", agentName: "qualityreview-security" },
    ],
    fixer: { cli: "claude", model: "sonnet", agentName: "review-fixer" },
    ...overrides,
  };
}

function makeDefaultAggregate(overrides?: object) {
  return {
    total: 0,
    C: 0,
    H: 0,
    M: 0,
    L: 0,
    nextId: 2,
    issuesFile: "/tmp/review-issues-qualityreview.txt",
    converged: true,
    verdicts: "",
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<ReviewRunnerDeps>): ReviewRunnerDeps {
  return {
    fileSystem: makeFileSystem(),
    dispatcher: makeDispatcher(0),
    config: null,
    ...overrides,
  };
}

const REVIEW_TYPE = "qualityreview";
const TARGET_FILE = "/project/specs/my-feature";
const FEATURE_DIR = "specs/my-feature";
const PROJECT_DIR = "/project";

describe("ReviewRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedExecFileSync.mockReset();
    dispatchWithRetrySpy.mockClear();

    // デフォルト: setup 成功 (2 personas), aggregate 収束
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedSetupReview.mockReturnValue(makeDefaultSetup() as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedAggregateReviews.mockReturnValue(makeDefaultAggregate() as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------
  // 構築テスト
  // ---------------------------------------------------------------

  it("ReviewRunner を deps で構築できる", () => {
    const deps = makeDeps();
    expect(() => new ReviewRunner(deps)).not.toThrow();
  });

  // ---------------------------------------------------------------
  // setupReview 失敗 → NO-GO / exitCode=1
  // ---------------------------------------------------------------

  it("runReviewSetup が例外を投げた場合 verdict=NO-GO, exitCode=1 を返す", async () => {
    // setupReview が例外を投げる（Unknown review type など）
    mockedSetupReview.mockImplementation(() => {
      throw new Error("review-setup failed");
    });

    const runner = new ReviewRunner(makeDeps());
    const events: unknown[] = [];

    const result = await runner.run(
      REVIEW_TYPE, TARGET_FILE, FEATURE_DIR, PROJECT_DIR,
      (e) => events.push(e)
    );

    expect(result.verdict).toBe("NO-GO");
    expect(result.exitCode).toBe(1);
    expect(result.iterations).toBe(0);
    expect(result.converged).toBe(false);

    const errorEvent = events.find(
      (e): e is { status: string } =>
        typeof e === "object" && e !== null &&
        "status" in e && (e as { status: string }).status === "error"
    );
    expect(errorEvent).toBeDefined();
  });

  // ---------------------------------------------------------------
  // 収束（converged=true）→ GO / exitCode=0
  // ---------------------------------------------------------------

  it("1イテレーションで収束した場合 verdict=GO, exitCode=0 を返す", async () => {
    // personas: [] → ペルソナ dispatch をスキップし aggregate まで到達
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedSetupReview.mockReturnValue(makeDefaultSetup({ personas: [] }) as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedAggregateReviews.mockReturnValue(makeDefaultAggregate({ converged: true }) as any);

    const fileSystem = makeFileSystem({});

    const runner = new ReviewRunner({ ...makeDeps(), fileSystem });
    const events: unknown[] = [];

    const promise = runner.run(
      REVIEW_TYPE, TARGET_FILE, FEATURE_DIR, PROJECT_DIR,
      (e) => events.push(e)
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.verdict).toBe("GO");
    expect(result.exitCode).toBe(0);
    expect(result.converged).toBe(true);
  });

  // ---------------------------------------------------------------
  // 全ペルソナ失敗 → exitCode=3（rate-limit）
  // ---------------------------------------------------------------

  it("全ペルソナが失敗した場合 exitCode=3 を返す（rate-limit）", async () => {
    // 常に失敗するディスパッチャー
    const dispatcher = makeDispatcher(1);

    // ペルソナのコマンドファイルとエージェントファイルを存在させる
    const fileSystem = makeFileSystem({
      "/project/commands/poor-dev.qualityreview-code.md": "# code review",
      "/project/commands/poor-dev.qualityreview-security.md": "# security review",
      // compose-prompt.sh の出力ファイル（promptFile）は存在しない → persona skip
    });

    const runner = new ReviewRunner({ ...makeDeps(), dispatcher, fileSystem });
    const events: unknown[] = [];

    const promise = runner.run(
      REVIEW_TYPE, TARGET_FILE, FEATURE_DIR, PROJECT_DIR,
      (e) => events.push(e)
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    // 全ペルソナ失敗:
    // commandFile は存在するが fs.statSync(TARGET_FILE) が ENOENT を投げるため
    // dispatchPersona が reject → failedCount === personas.length → exitCode=3
    expect(result.exitCode).toBe(3);
  });

  // ---------------------------------------------------------------
  // MAX_ITER 到達 → CONDITIONAL / NO-GO
  // ---------------------------------------------------------------

  it("MAX_ITER 到達時、C=0 なら CONDITIONAL を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedSetupReview.mockReturnValue(makeDefaultSetup({ maxIterations: 1, personas: [] }) as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedAggregateReviews.mockReturnValue(makeDefaultAggregate({ converged: false, C: 0, H: 2 }) as any);

    const fileSystem = makeFileSystem();
    const runner = new ReviewRunner({ ...makeDeps(), fileSystem });
    const events: unknown[] = [];

    const promise = runner.run(
      REVIEW_TYPE, TARGET_FILE, FEATURE_DIR, PROJECT_DIR,
      (e) => events.push(e)
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.verdict).toBe("CONDITIONAL");
    expect(result.exitCode).toBe(0);
    expect(result.converged).toBe(false);
  });

  it("MAX_ITER 到達時、C>0 なら NO-GO を返す", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedSetupReview.mockReturnValue(makeDefaultSetup({ maxIterations: 1, personas: [] }) as any);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    mockedAggregateReviews.mockReturnValue(makeDefaultAggregate({ converged: false, C: 3, H: 1 }) as any);

    const fileSystem = makeFileSystem();
    const runner = new ReviewRunner({ ...makeDeps(), fileSystem });
    const events: unknown[] = [];

    const promise = runner.run(
      REVIEW_TYPE, TARGET_FILE, FEATURE_DIR, PROJECT_DIR,
      (e) => events.push(e)
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.verdict).toBe("NO-GO");
    expect(result.exitCode).toBe(2);
  });

  // ---------------------------------------------------------------
  // stateManager が RetryOptions に含まれない（logRetry no-op 保証）
  // code-trace.md §3-3: review-runner サブシェルでは STATE_FILE 未設定
  // ---------------------------------------------------------------

  it("review-runner は RetryOptions に stateManager を渡さない（logRetry no-op 保証）", async () => {
    // デフォルト: setup=2 personas, aggregate=converged
    // (beforeEach で設定済み)

    const fileSystem = makeFileSystem({
      "/project/commands/poor-dev.qualityreview-code.md": "# code review",
      "/project/commands/poor-dev.qualityreview-security.md": "# security review",
    });

    // compose-prompt.sh (まだ bash) の execFileSync を用途別にモック:
    // fileSystem.exists() 経由でチェックされるため、モック fileSystem にも登録する
    mockedExecFileSync.mockImplementation((_cmd: unknown, args: unknown) => {
      const argsArr = args as string[];
      const script = argsArr[0] ?? "";
      if (script.includes("compose-prompt.sh")) {
        // promptFile (argsArr[2]) を実ファイルシステムとモック両方に書き出す
        if (argsArr[2]) {
          nodeFs.writeFileSync(argsArr[2], "mock prompt");
          fileSystem.writeFile(argsArr[2], "mock prompt");
        }
        return "" as unknown as ReturnType<typeof execFileSync>;
      }
      return "" as unknown as ReturnType<typeof execFileSync>;
    });

    const runner = new ReviewRunner({ ...makeDeps(), fileSystem });
    // TARGET_FILE に実在するディレクトリ(/tmp)を使用することで
    // fs.statSync のモックが不要になる（ESM では vi.spyOn(nodeFs, ...) は不可）
    const promise = runner.run(REVIEW_TYPE, "/tmp", FEATURE_DIR, PROJECT_DIR, () => {});
    await vi.runAllTimersAsync();
    await promise;

    // 一時 promptFile を削除
    for (const call of mockedExecFileSync.mock.calls) {
      const argsArr = call[1] as string[] | undefined;
      if (argsArr?.[0]?.includes("compose-prompt.sh") && argsArr[2]) {
        try { nodeFs.unlinkSync(argsArr[2]); } catch { /* ignore */ }
      }
    }

    // dispatchWithRetry が少なくとも1回呼ばれた（ペルソナが実際にディスパッチされた）
    expect(dispatchWithRetrySpy).toHaveBeenCalled();

    // 全ての呼び出しで RetryOptions に stateManager が含まれていないことを確認
    // review-runner.ts: retryOpts = { config, maxRetriesOverride } のみ
    for (const call of dispatchWithRetrySpy.mock.calls) {
      const retryOpts = call[8]; // 9番目の引数 (options: RetryOptions)
      expect(retryOpts).not.toHaveProperty("stateManager");
    }
  });
});
