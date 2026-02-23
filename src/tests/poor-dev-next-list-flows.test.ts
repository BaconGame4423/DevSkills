/**
 * poor-dev-next --list-flows のテスト
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const CLI_PATH = path.resolve("dist/bin/poor-dev-next.js");

function runListFlows(projectDir: string): { flows: Array<{ name: string; description: string | null; steps: string[]; builtin: boolean }>; errors: string[] } {
  const stdout = execFileSync("node", [CLI_PATH, "--list-flows", "--project-dir", projectDir], {
    encoding: "utf-8",
    timeout: 10000,
  });
  return JSON.parse(stdout.trim());
}

describe("--list-flows", () => {
  it("built-in フローを返す（カスタムなし）", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-test-"));
    try {
      const result = runListFlows(tmpDir);
      expect(result.errors).toHaveLength(0);
      expect(result.flows.length).toBeGreaterThanOrEqual(5);
      const names = result.flows.map(f => f.name);
      expect(names).toContain("feature");
      expect(names).toContain("bugfix");
      expect(names).toContain("roadmap");
      expect(names).toContain("exploration");
      expect(names).toContain("investigation");
      expect(names).not.toContain("discovery-init");
      expect(names).not.toContain("discovery-rebuild");
      // 全て builtin: true
      for (const f of result.flows) {
        expect(f.builtin).toBe(true);
      }
      // description が存在する
      const feature = result.flows.find(f => f.name === "feature")!;
      expect(feature.description).toBeTruthy();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("カスタムフローも返す", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-test-"));
    try {
      const poorDevDir = path.join(tmpDir, ".poor-dev");
      fs.mkdirSync(poorDevDir, { recursive: true });
      fs.writeFileSync(
        path.join(poorDevDir, "flows.json"),
        JSON.stringify({
          "my-flow": { steps: ["a", "b"], description: "カスタム" },
        })
      );
      const result = runListFlows(tmpDir);
      expect(result.errors).toHaveLength(0);
      const myFlow = result.flows.find(f => f.name === "my-flow");
      expect(myFlow).toBeDefined();
      expect(myFlow!.builtin).toBe(false);
      expect(myFlow!.description).toBe("カスタム");
      expect(myFlow!.steps).toEqual(["a", "b"]);
      // built-in も含まれている
      expect(result.flows.find(f => f.name === "feature")).toBeDefined();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
