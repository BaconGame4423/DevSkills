/**
 * pipeline-state.test.ts
 *
 * FilePipelineStateManager の状態遷移テスト。
 *
 * カバレッジ:
 * - init → completeStep → setStatus の基本遷移
 * - setApproval / clearApproval の awaiting-approval ⇔ active 遷移
 * - setPipeline の current 再計算
 * - addImplementPhase の動的フィールド追加 + deduplication（init スキーマ外）
 * - logRetry の no-op ガード（stateFile 未存在）
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FilePipelineStateManager } from "../lib/pipeline-state.js";
import { makeFileSystem } from "./fixtures/mocks.js";
import type { FileSystem } from "../lib/interfaces.js";

const STATE_FILE = "/tmp/test-pipeline-state.json";
const FEATURE_STEPS = ["specify", "suggest", "plan", "implement", "phasereview"];

function makeManager(fs: FileSystem) {
  return new FilePipelineStateManager(fs);
}

describe("FilePipelineStateManager", () => {
  let fs: FileSystem;
  let mgr: FilePipelineStateManager;

  beforeEach(() => {
    fs = makeFileSystem();
    mgr = makeManager(fs);
  });

  // ---------------------------------------------------------------
  // init
  // ---------------------------------------------------------------

  describe("init", () => {
    it("必要フィールドが正しく初期化される", () => {
      const state = mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      expect(state.flow).toBe("feature");
      expect(state.variant).toBeNull();
      expect(state.pipeline).toEqual(FEATURE_STEPS);
      expect(state.completed).toEqual([]);
      expect(state.current).toBe("specify");
      expect(state.status).toBe("active");
      expect(state.pauseReason).toBeNull();
      expect(state.pendingApproval).toBeNull();
    });

    it("implement_phases_completed は init スキーマに含まれない", () => {
      const state = mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      // code-trace.md §5-1: 動的フィールドのため init 直後は undefined
      expect(state.implement_phases_completed).toBeUndefined();
    });

    it("retries は init スキーマに含まれない", () => {
      const state = mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      expect(state.retries).toBeUndefined();
    });

    it("stateFile に JSON が書き込まれる", () => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      expect(fs.exists(STATE_FILE)).toBe(true);
      const raw = JSON.parse(fs.readFile(STATE_FILE));
      expect(raw.flow).toBe("feature");
    });

    it("ステップが空の場合 current は null", () => {
      const state = mgr.init(STATE_FILE, "feature", []);
      expect(state.current).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // completeStep
  // ---------------------------------------------------------------

  describe("completeStep", () => {
    beforeEach(() => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
    });

    it("completed に追加される", () => {
      const state = mgr.completeStep(STATE_FILE, "specify");
      expect(state.completed).toContain("specify");
    });

    it("current が次のステップに更新される", () => {
      const state = mgr.completeStep(STATE_FILE, "specify");
      expect(state.current).toBe("suggest");
    });

    it("全ステップ完了後 current は null", () => {
      for (const step of FEATURE_STEPS) {
        mgr.completeStep(STATE_FILE, step);
      }
      const state = mgr.read(STATE_FILE);
      expect(state.current).toBeNull();
    });

    it("同じステップを2回追加しても重複しない", () => {
      mgr.completeStep(STATE_FILE, "specify");
      const state = mgr.completeStep(STATE_FILE, "specify");
      expect(state.completed.filter((s) => s === "specify")).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------
  // setStatus
  // ---------------------------------------------------------------

  describe("setStatus", () => {
    beforeEach(() => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
    });

    it("status が更新される", () => {
      const state = mgr.setStatus(STATE_FILE, "paused", "NO-GO verdict");
      expect(state.status).toBe("paused");
      expect(state.pauseReason).toBe("NO-GO verdict");
    });

    it("reason 省略時 pauseReason は null", () => {
      const state = mgr.setStatus(STATE_FILE, "completed");
      expect(state.pauseReason).toBeNull();
    });

    it("rate-limited ステータスが設定できる", () => {
      const state = mgr.setStatus(STATE_FILE, "rate-limited", "Rate limit at implement");
      expect(state.status).toBe("rate-limited");
      expect(state.pauseReason).toBe("Rate limit at implement");
    });
  });

  // ---------------------------------------------------------------
  // setApproval / clearApproval
  // ---------------------------------------------------------------

  describe("setApproval → clearApproval 遷移", () => {
    beforeEach(() => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
    });

    it("setApproval で status が awaiting-approval になる", () => {
      const state = mgr.setApproval(STATE_FILE, "gate", "specify");
      expect(state.status).toBe("awaiting-approval");
      expect(state.pendingApproval).toEqual({ type: "gate", step: "specify" });
      expect(state.pauseReason).toBe("gate at specify");
    });

    it("clearApproval で status が active に戻る", () => {
      mgr.setApproval(STATE_FILE, "gate", "specify");
      const state = mgr.clearApproval(STATE_FILE);
      expect(state.status).toBe("active");
      expect(state.pendingApproval).toBeNull();
      expect(state.pauseReason).toBeNull();
    });

    it("clarification タイプの approval が設定できる", () => {
      const state = mgr.setApproval(STATE_FILE, "clarification", "specify");
      expect(state.pendingApproval?.type).toBe("clarification");
    });
  });

  // ---------------------------------------------------------------
  // setPipeline
  // ---------------------------------------------------------------

  describe("setPipeline", () => {
    it("pipeline が置換され current が再計算される", () => {
      mgr.init(STATE_FILE, "bugfix", ["bugfix"]);
      mgr.completeStep(STATE_FILE, "bugfix");

      const newPipeline = ["bugfix", "planreview", "implement", "qualityreview", "phasereview"];
      const state = mgr.setPipeline(STATE_FILE, newPipeline);

      expect(state.pipeline).toEqual(newPipeline);
      // bugfix は既に completed なので current は planreview
      expect(state.current).toBe("planreview");
    });

    it("全ステップ完了済みの pipeline に置換すると current は null", () => {
      mgr.init(STATE_FILE, "feature", ["specify"]);
      mgr.completeStep(STATE_FILE, "specify");

      const state = mgr.setPipeline(STATE_FILE, ["specify"]);
      expect(state.current).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // setVariant
  // ---------------------------------------------------------------

  describe("setVariant", () => {
    it("variant と condition が設定される", () => {
      mgr.init(STATE_FILE, "bugfix", ["bugfix"]);
      const state = mgr.setVariant(STATE_FILE, "bugfix-small", { scale: "SMALL" });
      expect(state.variant).toBe("bugfix-small");
      expect(state.condition).toEqual({ scale: "SMALL" });
    });
  });

  // ---------------------------------------------------------------
  // addImplementPhase（動的フィールド）
  // ---------------------------------------------------------------

  describe("addImplementPhase", () => {
    beforeEach(() => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
    });

    it("init 後に addImplementPhase すると implement_phases_completed が追加される", () => {
      const state = mgr.addImplementPhase(STATE_FILE, "phase_1");
      expect(state.implement_phases_completed).toEqual(["phase_1"]);
    });

    it("複数フェーズを追加できる", () => {
      mgr.addImplementPhase(STATE_FILE, "phase_1");
      const state = mgr.addImplementPhase(STATE_FILE, "phase_2");
      expect(state.implement_phases_completed).toEqual(["phase_1", "phase_2"]);
    });

    it("同じキーを2回追加しても重複しない（unique 保証）", () => {
      mgr.addImplementPhase(STATE_FILE, "phase_1");
      const state = mgr.addImplementPhase(STATE_FILE, "phase_1");
      expect(state.implement_phases_completed).toEqual(["phase_1"]);
    });

    it("addImplementPhase は既存フィールドに非破壊的に追加される", () => {
      mgr.addImplementPhase(STATE_FILE, "phase_1");
      mgr.addImplementPhase(STATE_FILE, "phase_2");
      // 他フィールドが壊れていないことを確認
      const state = mgr.read(STATE_FILE);
      expect(state.flow).toBe("feature");
      expect(state.status).toBe("active");
      expect(state.implement_phases_completed).toEqual(["phase_1", "phase_2"]);
    });
  });

  // ---------------------------------------------------------------
  // logRetry（no-op ガード）
  // ---------------------------------------------------------------

  describe("logRetry", () => {
    it("stateFile が存在しない場合は no-op（エラーにならない）", () => {
      // pipeline-state.sh の log_retry_attempt: STATE_FILE 未存在時スキップ
      // review-runner サブシェル（STATE_FILE 未設定）のケース
      expect(() =>
        mgr.logRetry("/nonexistent/pipeline-state.json", "qualityreview-code", 1, 1, 30)
      ).not.toThrow();
      // stateFile に書き込みがないことを確認
      expect(fs.exists("/nonexistent/pipeline-state.json")).toBe(false);
    });

    it("stateFile が存在する場合は retries[] に追記される", () => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      mgr.logRetry(STATE_FILE, "specify", 1, 1, 30);
      const state = mgr.read(STATE_FILE);
      expect(state.retries).toHaveLength(1);
      expect(state.retries![0]).toMatchObject({
        step: "specify",
        attempt: 1,
        exit_code: 1,
        backoff: 30,
      });
    });

    it("複数のリトライが順番に追記される", () => {
      mgr.init(STATE_FILE, "feature", FEATURE_STEPS);
      mgr.logRetry(STATE_FILE, "specify", 1, 1, 30);
      mgr.logRetry(STATE_FILE, "specify", 2, 1, 60);
      const state = mgr.read(STATE_FILE);
      expect(state.retries).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // read（ファイル未存在）
  // ---------------------------------------------------------------

  describe("read", () => {
    it("stateFile が存在しない場合は空オブジェクトを返す", () => {
      const state = mgr.read("/nonexistent/state.json");
      expect(state).toEqual({});
    });
  });
});
