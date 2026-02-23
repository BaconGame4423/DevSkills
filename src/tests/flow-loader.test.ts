/**
 * flow-loader.test.ts
 *
 * カスタムフロー読み込み + バリデーション + マージのテスト。
 */

import { describe, it, expect } from "vitest";
import {
  validateFlowDefinition,
  loadCustomFlows,
  mergeFlows,
  resolveFlow,
} from "../lib/flow-loader.js";
import { BUILTIN_FLOWS } from "../lib/flow-definitions.js";

// --- モック FileSystem ---

function mockFs(files: Record<string, string>) {
  return {
    exists: (p: string) => p in files,
    readFile: (p: string) => {
      if (!(p in files)) throw new Error(`not found: ${p}`);
      return files[p]!;
    },
  };
}

// --- validateFlowDefinition ---

describe("validateFlowDefinition", () => {
  it("有効な FlowDefinition を受け入れる", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["a", "b"],
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("null を拒否する", () => {
    const { valid } = validateFlowDefinition("test", null);
    expect(valid).toBe(false);
  });

  it("steps が配列でない場合を拒否する", () => {
    const { valid, errors } = validateFlowDefinition("test", { steps: "a" });
    expect(valid).toBe(false);
    expect(errors[0]).toContain("must be an array");
  });

  it("空 steps を拒否する", () => {
    const { valid, errors } = validateFlowDefinition("test", { steps: [] });
    expect(valid).toBe(false);
    expect(errors[0]).toContain("must not be empty");
  });

  it("steps の要素が文字列でない場合を拒否する", () => {
    const { valid } = validateFlowDefinition("test", { steps: [1, 2] });
    expect(valid).toBe(false);
  });

  it("reviews が配列でない場合を拒否する", () => {
    const { valid } = validateFlowDefinition("test", {
      steps: ["a"],
      reviews: "not-array",
    });
    expect(valid).toBe(false);
  });

  it("オプションフィールドなしでも有効", () => {
    const { valid } = validateFlowDefinition("test", { steps: ["a"] });
    expect(valid).toBe(true);
  });

  it("description フィールドを持つ FlowDefinition を受け入れる", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["a", "b"],
      description: "テストフロー",
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("有効な userGates を受け入れる", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["discovery"],
      userGates: {
        discovery: {
          message: "次のステップを選択",
          options: [
            { label: "ロードマップ", conditionalKey: "discovery:ROADMAP" },
            { label: "終了", conditionalKey: "discovery:DONE" },
          ],
        },
      },
    });
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it("userGates が object でない場合を拒否する", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["a"],
      userGates: "invalid",
    });
    expect(valid).toBe(false);
    expect(errors[0]).toContain("must be an object");
  });

  it("userGates の option に label がない場合を拒否する", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["a"],
      userGates: {
        a: {
          message: "msg",
          options: [{ conditionalKey: "a:X" }],
        },
      },
    });
    expect(valid).toBe(false);
    expect(errors.some((e: string) => e.includes("label"))).toBe(true);
  });

  it("userGates と conditionals の排他チェック", () => {
    const { valid, errors } = validateFlowDefinition("test", {
      steps: ["a"],
      conditionals: ["a"],
      userGates: {
        a: {
          message: "msg",
          options: [{ label: "x", conditionalKey: "a:X" }],
        },
      },
    });
    expect(valid).toBe(false);
    expect(errors.some((e: string) => e.includes("mutually exclusive"))).toBe(true);
  });
});

// --- loadCustomFlows ---

describe("loadCustomFlows", () => {
  it("flows.json がない場合は空を返す", () => {
    const fs = mockFs({});
    const { flows, errors } = loadCustomFlows("/proj", fs);
    expect(flows).toEqual({});
    expect(errors).toHaveLength(0);
  });

  it("有効な flows.json を読み込む", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        "micro-feature": {
          steps: ["specify", "implement"],
        },
      }),
    });
    const { flows, errors } = loadCustomFlows("/proj", fs);
    expect(errors).toHaveLength(0);
    expect(flows["micro-feature"]).toBeDefined();
    expect(flows["micro-feature"]!.steps).toEqual(["specify", "implement"]);
  });

  it("不正な JSON でエラーを返す", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": "not json",
    });
    const { errors } = loadCustomFlows("/proj", fs);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Failed to parse");
  });

  it("バリデーション失敗のフローをスキップする", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        good: { steps: ["a"] },
        bad: { steps: [] },
      }),
    });
    const { flows, errors } = loadCustomFlows("/proj", fs);
    expect(flows["good"]).toBeDefined();
    expect(flows["bad"]).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });
});

// --- mergeFlows ---

describe("mergeFlows", () => {
  it("カスタムフローなしでビルトインのみ返す", () => {
    const fs = mockFs({});
    const { flows } = mergeFlows("/proj", fs);
    expect(Object.keys(flows)).toEqual(Object.keys(BUILTIN_FLOWS));
  });

  it("カスタムフローがビルトインを上書きする", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        feature: { steps: ["custom-specify", "custom-implement"] },
      }),
    });
    const { flows } = mergeFlows("/proj", fs);
    expect(flows["feature"]!.steps).toEqual(["custom-specify", "custom-implement"]);
  });

  it("カスタムフローを追加できる", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        "my-flow": { steps: ["a", "b"] },
      }),
    });
    const { flows } = mergeFlows("/proj", fs);
    expect(flows["my-flow"]).toBeDefined();
    expect(flows["feature"]).toBeDefined(); // ビルトインも残る
  });

  it("カスタムフローの description がマージ後も保持される", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        "my-flow": { steps: ["a", "b"], description: "カスタムワークフロー" },
      }),
    });
    const { flows } = mergeFlows("/proj", fs);
    expect(flows["my-flow"]!.description).toBe("カスタムワークフロー");
  });

  it("ビルトインフローの description が存在する", () => {
    const fs = mockFs({});
    const { flows } = mergeFlows("/proj", fs);
    expect(flows["feature"]!.description).toBeDefined();
    expect(typeof flows["feature"]!.description).toBe("string");
  });
});

// --- resolveFlow ---

describe("resolveFlow", () => {
  it("ビルトインフローを解決できる", () => {
    const fs = mockFs({});
    const flow = resolveFlow("feature", "/proj", fs);
    expect(flow).toBeDefined();
    expect(flow!.steps).toContain("specify");
  });

  it("カスタムフローを優先的に解決する", () => {
    const fs = mockFs({
      "/proj/.poor-dev/flows.json": JSON.stringify({
        feature: { steps: ["custom"] },
      }),
    });
    const flow = resolveFlow("feature", "/proj", fs);
    expect(flow!.steps).toEqual(["custom"]);
  });

  it("存在しないフローで null を返す", () => {
    const fs = mockFs({});
    expect(resolveFlow("nonexistent", "/proj", fs)).toBeNull();
  });
});
