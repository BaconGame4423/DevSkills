/**
 * config.test.ts
 *
 * config.ts (config.sh TS 移植) の単体テスト。
 *
 * カバレッジ:
 * - resolveOne: 5段階解決チェーン
 * - configCmd: show/default/set/unset/tier/step-tier/depth/speculation/parallel/reset
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import {
  resolveOne,
  configCmd,
  readConfigFile,
  type PoorDevConfigFile,
} from "../lib/config.js";

// ================================================================
// resolveOne
// ================================================================

describe("resolveOne", () => {
  const baseCfg: PoorDevConfigFile = {
    default: { cli: "opencode", model: "glm-4.7" },
    overrides: {
      fixer: { cli: "claude", model: "sonnet" },
    },
    tiers: {
      T1: { cli: "claude", model: "opus" },
      T2: { cli: "opencode", model: "minimax" },
    },
    step_tiers: {
      specify: "T2",
      plan: "T1",
    },
  };

  it("override が存在する key → override を返す", () => {
    const result = resolveOne(baseCfg, "fixer");
    expect(result.cli).toBe("claude");
    expect(result.model).toBe("sonnet");
    expect(result.source).toBe("override");
  });

  it("step_tier が存在する step → step_tier(TN) を返す", () => {
    const result = resolveOne(baseCfg, "specify");
    expect(result.cli).toBe("opencode");
    expect(result.model).toBe("minimax");
    expect(result.source).toBe("step_tier(T2)");
  });

  it("step_tier の tier が存在しない → default を返しソースに undefinedティア名が入る", () => {
    const cfg: PoorDevConfigFile = {
      default: { cli: "claude", model: "haiku" },
      step_tiers: { specify: "T99" },
    };
    const result = resolveOne(cfg, "specify");
    expect(result.cli).toBe("claude");
    expect(result.source).toContain("T99");
    expect(result.source).toContain("undefined");
  });

  it("何も設定なし → default を返す", () => {
    const result = resolveOne(baseCfg, "suggest");
    expect(result.cli).toBe("opencode");
    expect(result.model).toBe("glm-4.7");
    expect(result.source).toBe("default");
  });

  it("カテゴリ override (qualityreview) が qua lityreview-code に適用される", () => {
    const cfg: PoorDevConfigFile = {
      default: { cli: "opencode", model: "x" },
      overrides: { qualityreview: { cli: "claude", model: "haiku" } },
    };
    const result = resolveOne(cfg, "qualityreview-code");
    expect(result.cli).toBe("claude");
    expect(result.source).toContain("override(qualityreview)");
  });

  it("agent 固有 override が category override より優先される", () => {
    const cfg: PoorDevConfigFile = {
      default: { cli: "opencode", model: "x" },
      overrides: {
        qualityreview: { cli: "claude", model: "haiku" },
        "qualityreview-code": { cli: "opencode", model: "ultra" },
      },
    };
    const result = resolveOne(cfg, "qualityreview-code");
    expect(result.model).toBe("ultra");
    expect(result.source).toBe("override");
  });
});

// ================================================================
// configCmd (tmpDir 使用)
// ================================================================

describe("configCmd", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-config-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- show ---
  it("show: デフォルト設定を表示する", () => {
    const result = configCmd(tmpDir, ["show"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Default:");
    expect(result.output).toContain("Tiers:");
    expect(result.output).toContain("Review depth:");
  });

  // --- default ---
  it("default: 有効な CLI/model を設定する", () => {
    const result = configCmd(tmpDir, ["default", "claude", "sonnet"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Default set: claude / sonnet");

    const cfg = readConfigFile(tmpDir);
    expect(cfg.default.cli).toBe("claude");
    expect(cfg.default.model).toBe("sonnet");
  });

  it("default: 無効な CLI → exitCode=1", () => {
    const result = configCmd(tmpDir, ["default", "invalid-cli", "sonnet"]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Invalid CLI");
  });

  it("default: claude + 無効なモデル → exitCode=1", () => {
    const result = configCmd(tmpDir, ["default", "claude", "ultra-model"]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Invalid Claude model");
  });

  it("default: opencode + 任意のモデル → 成功", () => {
    const result = configCmd(tmpDir, ["default", "opencode", "arbitrary-model-xyz"]);
    expect(result.exitCode).toBe(0);
  });

  // --- set ---
  it("set: 有効なオーバーライドを設定する", () => {
    const result = configCmd(tmpDir, ["set", "fixer", "claude", "haiku"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.overrides?.["fixer"]?.cli).toBe("claude");
    expect(cfg.overrides?.["fixer"]?.model).toBe("haiku");
  });

  it("set: 無効なキー → exitCode=1", () => {
    const result = configCmd(tmpDir, ["set", "unknown-key", "claude", "sonnet"]);
    expect(result.exitCode).toBe(1);
  });

  // --- unset ---
  it("unset: 存在するオーバーライドを削除する", () => {
    configCmd(tmpDir, ["set", "fixer", "claude", "haiku"]);
    const result = configCmd(tmpDir, ["unset", "fixer"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Override removed: fixer");

    const cfg = readConfigFile(tmpDir);
    expect(cfg.overrides?.["fixer"]).toBeUndefined();
  });

  it("unset: 存在しないオーバーライド → exitCode=1", () => {
    // DEFAULT_CONFIG に存在しないキーを指定してエラーを確認
    const result = configCmd(tmpDir, ["unset", "custom-nonexistent"]);
    expect(result.exitCode).toBe(1);
  });

  // --- tier ---
  it("tier: 新しい tier を定義する", () => {
    const result = configCmd(tmpDir, ["tier", "T4", "opencode", "fast-model"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.tiers?.["T4"]?.model).toBe("fast-model");
  });

  // --- tier-unset ---
  it("tier-unset: tier を削除する", () => {
    configCmd(tmpDir, ["tier", "TX", "opencode", "model-x"]);
    const result = configCmd(tmpDir, ["tier-unset", "TX"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.tiers?.["TX"]).toBeUndefined();
  });

  it("tier-unset: 存在しない tier → exitCode=1", () => {
    const result = configCmd(tmpDir, ["tier-unset", "T999"]);
    expect(result.exitCode).toBe(1);
  });

  // --- step-tier ---
  it("step-tier: ステップに tier を割り当てる", () => {
    const result = configCmd(tmpDir, ["step-tier", "specify", "T1"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.step_tiers?.["specify"]).toBe("T1");
  });

  it("step-tier: 無効なステップ → exitCode=1", () => {
    const result = configCmd(tmpDir, ["step-tier", "invalid-step", "T1"]);
    expect(result.exitCode).toBe(1);
  });

  it("step-tier: 存在しない tier → exitCode=1", () => {
    const result = configCmd(tmpDir, ["step-tier", "specify", "T999"]);
    expect(result.exitCode).toBe(1);
  });

  // --- step-tier-unset ---
  it("step-tier-unset: tier 割り当てを削除する", () => {
    configCmd(tmpDir, ["step-tier", "specify", "T1"]);
    const result = configCmd(tmpDir, ["step-tier-unset", "specify"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.step_tiers?.["specify"]).toBeUndefined();
  });

  // --- depth ---
  it("depth: 有効な深度を設定する", () => {
    const result = configCmd(tmpDir, ["depth", "deep"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.review_depth).toBe("deep");
  });

  it("depth: 無効な値 → exitCode=1", () => {
    const result = configCmd(tmpDir, ["depth", "extreme"]);
    expect(result.exitCode).toBe(1);
  });

  // --- speculation ---
  it("speculation on: speculation を有効化する", () => {
    const result = configCmd(tmpDir, ["speculation", "on"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("enabled");

    const cfg = readConfigFile(tmpDir);
    expect(cfg.speculation?.enabled).toBe(true);
  });

  it("speculation off: speculation を無効化する", () => {
    const result = configCmd(tmpDir, ["speculation", "off"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("disabled");
  });

  // --- parallel ---
  it("parallel on: parallel を有効化する", () => {
    const result = configCmd(tmpDir, ["parallel", "on"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("enabled");

    const cfg = readConfigFile(tmpDir);
    expect(cfg.parallel?.enabled).toBe(true);
    expect(cfg.parallel?.strategy).toBe("auto");
  });

  it("parallel phase-split: 戦略を設定する", () => {
    const result = configCmd(tmpDir, ["parallel", "phase-split"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.parallel?.strategy).toBe("phase-split");
  });

  it("parallel off: parallel を無効化する", () => {
    const result = configCmd(tmpDir, ["parallel", "off"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("disabled");

    const cfg = readConfigFile(tmpDir);
    expect(cfg.parallel?.enabled).toBe(false);
  });

  // --- reset ---
  it("reset: デフォルト設定に戻す", () => {
    configCmd(tmpDir, ["default", "claude", "haiku"]);
    const result = configCmd(tmpDir, ["reset"]);
    expect(result.exitCode).toBe(0);

    const cfg = readConfigFile(tmpDir);
    expect(cfg.default.cli).toBe("opencode");
    expect(cfg.default.model).toBe("zai-coding-plan/glm-4.7");
  });

  // --- help ---
  it("help: ヘルプを表示する", () => {
    const result = configCmd(tmpDir, ["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Subcommands:");
  });

  // --- 不明なサブコマンド ---
  it("unknown: 不明なサブコマンド → exitCode=1", () => {
    const result = configCmd(tmpDir, ["unknown-subcmd"]);
    expect(result.exitCode).toBe(1);
  });

  // --- 引数なし → show ---
  it("引数なし → show が実行される", () => {
    const result = configCmd(tmpDir, []);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Default:");
  });
});
