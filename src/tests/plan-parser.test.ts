/**
 * plan-parser.test.ts
 *
 * parsePlanFile, toKebabCase, resolveNextFeatureNumber, generateDiscussionSummary のテスト。
 * --init-from-plan 統合テスト。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parsePlanFile,
  toKebabCase,
  resolveNextFeatureNumber,
  generateDiscussionSummary,
} from "../lib/plan-parser.js";
import type { ParsedPlan } from "../lib/plan-parser.js";
import type { FileSystem } from "../lib/interfaces.js";

// --- toKebabCase ---

describe("toKebabCase", () => {
  it('"Function Visualizer" → "function-visualizer"', () => {
    expect(toKebabCase("Function Visualizer")).toBe("function-visualizer");
  });

  it("既に kebab-case → そのまま", () => {
    expect(toKebabCase("already-kebab")).toBe("already-kebab");
  });

  it("全非ASCII → 空文字列", () => {
    expect(toKebabCase("日本語テスト")).toBe("");
  });

  it("特殊文字除去", () => {
    expect(toKebabCase("Hello, World! (v2.0)")).toBe("hello-world-v20");
  });

  it("先頭末尾のハイフン除去", () => {
    expect(toKebabCase("--test--")).toBe("test");
  });

  it("連続スペース → 単一ハイフン", () => {
    expect(toKebabCase("a   b   c")).toBe("a-b-c");
  });

  it("大文字混在", () => {
    expect(toKebabCase("Init From Plan")).toBe("init-from-plan");
  });
});

// --- resolveNextFeatureNumber ---

describe("resolveNextFeatureNumber", () => {
  function mockFs(entries: Array<{ name: string; isDirectory: boolean }>): Pick<FileSystem, "readdir" | "isDirectory"> {
    return {
      readdir: () => entries.map((e) => ({ ...e, isFile: !e.isDirectory })),
      isDirectory: () => true,
    };
  }

  it("features/ 空 → 1", () => {
    expect(resolveNextFeatureNumber("/features", mockFs([]))).toBe(1);
  });

  it("既存 001, 002 → 3", () => {
    expect(
      resolveNextFeatureNumber(
        "/features",
        mockFs([
          { name: "001-first", isDirectory: true },
          { name: "002-second", isDirectory: true },
        ])
      )
    ).toBe(3);
  });

  it("_runs/ 内は無視", () => {
    expect(
      resolveNextFeatureNumber(
        "/features",
        mockFs([
          { name: "001-first", isDirectory: true },
          { name: "_runs", isDirectory: true },
        ])
      )
    ).toBe(2);
  });

  it("ファイルは無視", () => {
    expect(
      resolveNextFeatureNumber(
        "/features",
        mockFs([
          { name: "001-first", isDirectory: true },
          { name: "999-fake.txt", isDirectory: false },
        ])
      )
    ).toBe(2);
  });

  it("非数値ディレクトリは無視", () => {
    expect(
      resolveNextFeatureNumber(
        "/features",
        mockFs([
          { name: "001-first", isDirectory: true },
          { name: "misc-stuff", isDirectory: true },
        ])
      )
    ).toBe(2);
  });
});

// --- parsePlanFile ---

describe("parsePlanFile", () => {
  it("全セクション揃った正常系", () => {
    const content = `# Plan

## Feature name
Function Visualizer

## Selected flow
feature

## Pipeline
proceed

## Scope summary
Add a function visualizer to the dashboard.

## Requirements
- Must support dark mode
- Real-time updates
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan).not.toBeNull();
    expect(result.plan!.featureName).toBe("function-visualizer");
    expect(result.plan!.flow).toBe("feature");
    expect(result.plan!.pipeline).toBe("proceed");
    expect(result.plan!.rawContent).toBe(content);
  });

  it("## Feature name 未指定 → scope summary フォールバック", () => {
    const content = `## Selected flow
feature

## Scope summary
Add a function visualizer to the dashboard with real-time updates and dark mode support.
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan).not.toBeNull();
    // 先頭5語: "Add a function visualizer to" → "add-a-function-visualizer-to"
    expect(result.plan!.featureName).toBe("add-a-function-visualizer-to");
  });

  it("## Pipeline 未指定 → proceed デフォルト + warning", () => {
    const content = `## Feature name
test-feature

## Selected flow
feature
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan).not.toBeNull();
    expect(result.plan!.pipeline).toBe("proceed");
    expect(result.warnings).toContainEqual(
      expect.stringContaining("Pipeline section not found")
    );
  });

  it("Pipeline: skip", () => {
    const content = `## Feature name
test

## Selected flow
feature

## Pipeline
skip
`;
    const result = parsePlanFile(content);

    expect(result.plan!.pipeline).toBe("skip");
  });

  it("## Selected flow 未指定 → エラー", () => {
    const content = `## Feature name
test-feature

## Pipeline
proceed
`;
    const result = parsePlanFile(content);

    expect(result.plan).toBeNull();
    expect(result.errors).toContainEqual(
      expect.stringContaining("Selected flow")
    );
  });

  it("セクション順序不問", () => {
    const content = `## Pipeline
proceed

## Feature name
reversed-order

## Selected flow
bugfix
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan!.featureName).toBe("reversed-order");
    expect(result.plan!.flow).toBe("bugfix");
    expect(result.plan!.pipeline).toBe("proceed");
  });

  it("空白・改行のバリエーション", () => {
    const content = `## Feature name

  spaced feature

## Selected flow
  feature

## Pipeline
  proceed
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan!.featureName).toBe("spaced-feature");
    expect(result.plan!.flow).toBe("feature");
  });

  it("全非ASCII feature name → タイムスタンプフォールバック", () => {
    const content = `## Feature name
日本語機能

## Selected flow
feature
`;
    const result = parsePlanFile(content);

    expect(result.errors).toEqual([]);
    expect(result.plan!.featureName).toMatch(/^feature-\d{8}-\d{6}$/);
  });
});

// --- generateDiscussionSummary ---

describe("generateDiscussionSummary", () => {
  it("全セクション含むサマリーを生成", () => {
    const plan: ParsedPlan = {
      featureName: "test-feature",
      flow: "feature",
      pipeline: "proceed",
      rawContent: `## Feature name
test-feature

## Selected flow
feature

## Scope summary
Add a new feature.

## Requirements
- Req 1
- Req 2

## Tech decisions
- Use TypeScript
`,
    };

    const summary = generateDiscussionSummary(plan);

    expect(summary).toContain("# Discussion Summary");
    expect(summary).toContain("**Flow**: feature");
    expect(summary).toContain("**Feature**: test-feature");
    expect(summary).toContain("## Scope");
    expect(summary).toContain("Add a new feature.");
    expect(summary).toContain("## Requirements");
    expect(summary).toContain("- Req 1");
    expect(summary).toContain("## Tech Decisions");
    expect(summary).toContain("- Use TypeScript");
  });

  it("任意セクション欠落時は省略", () => {
    const plan: ParsedPlan = {
      featureName: "minimal",
      flow: "feature",
      pipeline: "proceed",
      rawContent: `## Selected flow
feature
`,
    };

    const summary = generateDiscussionSummary(plan);

    expect(summary).toContain("# Discussion Summary");
    expect(summary).toContain("**Flow**: feature");
    expect(summary).not.toContain("## Scope");
    expect(summary).not.toContain("## Requirements");
    expect(summary).not.toContain("## Tech Decisions");
  });
});

// --- --init-from-plan 統合テスト ---

describe("--init-from-plan integration", () => {
  // 実際の CLI は起動せず、パーサー + ヘルパーの組み合わせテスト

  it("正常系: パース → ディレクトリ情報 → discussion-summary → pipeline-state", () => {
    const planContent = `## Feature name
function-visualizer

## Selected flow
feature

## Pipeline
proceed

## Scope summary
Visualize function call graphs in the editor.
`;
    const result = parsePlanFile(planContent);
    expect(result.plan).not.toBeNull();
    expect(result.errors).toEqual([]);

    const plan = result.plan!;
    expect(plan.featureName).toBe("function-visualizer");
    expect(plan.flow).toBe("feature");
    expect(plan.pipeline).toBe("proceed");

    // discussion-summary 生成
    const summary = generateDiscussionSummary(plan);
    expect(summary).toContain("function-visualizer");
    expect(summary).toContain("feature");

    // resolveNextFeatureNumber
    const mockFsObj: Pick<FileSystem, "readdir" | "isDirectory"> = {
      readdir: () => [],
      isDirectory: () => true,
    };
    const nextNum = resolveNextFeatureNumber("/features", mockFsObj);
    expect(nextNum).toBe(1);
  });

  it("Pipeline: skip → plan のみ消費", () => {
    const planContent = `## Feature name
question-only

## Selected flow
feature

## Pipeline
skip
`;
    const result = parsePlanFile(planContent);
    expect(result.plan).not.toBeNull();
    expect(result.plan!.pipeline).toBe("skip");
  });

  it("不明 flow → パース自体は成功 (flow 検証は CLI 側)", () => {
    const planContent = `## Feature name
test

## Selected flow
nonexistent-flow

## Pipeline
proceed
`;
    const result = parsePlanFile(planContent);
    // パーサーは flow の存在検証はしない（CLI 側の責務）
    expect(result.plan).not.toBeNull();
    expect(result.plan!.flow).toBe("nonexistent-flow");
  });
});
