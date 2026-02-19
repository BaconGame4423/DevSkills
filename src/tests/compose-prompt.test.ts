/**
 * compose-prompt.test.ts
 *
 * composePrompt() の単体テスト。
 * compose-prompt.ts (compose-prompt.sh TS 移植) のカバレッジ。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { composePrompt } from "../lib/compose-prompt.js";

describe("composePrompt", () => {
  let tmpDir: string;
  let commandFile: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pd-compose-test-"));
    commandFile = path.join(tmpDir, "command.md");
    outputFile = path.join(tmpDir, "output.txt");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- エラーケース ---

  it("commandFile が存在しない → success=false", () => {
    const result = composePrompt({
      commandFile: "/nonexistent/command.md",
      outputFile,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  // --- 基本的な生成 ---

  it("ヘッダーなし、コンテキストなし → コマンドファイルの内容をそのまま出力", () => {
    const cmdContent = "# My Command\n\nDo something.";
    fs.writeFileSync(commandFile, cmdContent);

    const result = composePrompt({ commandFile, outputFile });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).toContain("# My Command");
    expect(output).toContain("Do something.");
  });

  // --- YAML フロントマター除去 ---

  it("YAML フロントマターを除去する", () => {
    const cmdContent = [
      "---",
      "title: My Command",
      "version: 1.0",
      "---",
      "# Command body",
    ].join("\n");
    fs.writeFileSync(commandFile, cmdContent);

    const result = composePrompt({ commandFile, outputFile });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).not.toContain("title: My Command");
    expect(output).toContain("# Command body");
  });

  // --- ヘッダー ---

  it("non_interactive ヘッダーを追加する", () => {
    fs.writeFileSync(commandFile, "# Command");

    const result = composePrompt({
      commandFile,
      outputFile,
      headers: ["non_interactive"],
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).toContain("NON_INTERACTIVE");
  });

  it("readonly ヘッダーを追加する", () => {
    fs.writeFileSync(commandFile, "# Command");

    const result = composePrompt({
      commandFile,
      outputFile,
      headers: ["readonly"],
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).toContain("Read-Only Execution Mode");
  });

  it("複数ヘッダーを順番に追加する", () => {
    fs.writeFileSync(commandFile, "# Command");

    const result = composePrompt({
      commandFile,
      outputFile,
      headers: ["non_interactive", "readonly"],
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    const niIdx = output.indexOf("NON_INTERACTIVE");
    const roIdx = output.indexOf("Read-Only");
    expect(niIdx).toBeLessThan(roIdx);
  });

  // --- コンテキストファイル ---

  it("コンテキストファイルを追加する", () => {
    fs.writeFileSync(commandFile, "# Command");
    const ctxFile = path.join(tmpDir, "context.md");
    fs.writeFileSync(ctxFile, "Context content here");

    const result = composePrompt({
      commandFile,
      outputFile,
      contexts: { spec: ctxFile },
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).toContain("## Context: spec");
    expect(output).toContain("Context content here");
  });

  it("存在しないコンテキストファイルはスキップされる（エラーにならない）", () => {
    fs.writeFileSync(commandFile, "# Command");

    const result = composePrompt({
      commandFile,
      outputFile,
      contexts: { missing: "/nonexistent/file.md" },
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).not.toContain("## Context: missing");
  });

  it("10KB 超のコンテキストファイルは最初の 200 行でトランケートされる", () => {
    fs.writeFileSync(commandFile, "# Command");

    // 10KB 超のコンテキストファイルを作成（各行を36文字以上にして 300行×36≈10800 bytes > 10240）
    const largeContent = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}: ${"x".repeat(20)} content`).join("\n");
    const ctxFile = path.join(tmpDir, "large-ctx.md");
    fs.writeFileSync(ctxFile, largeContent);

    const result = composePrompt({
      commandFile,
      outputFile,
      contexts: { large: ctxFile },
    });
    expect(result.success).toBe(true);
    const output = fs.readFileSync(outputFile, "utf8");
    expect(output).toContain("TRUNCATED");
    // 200 行目を含み、201 行目以降を含まない
    expect(output).toContain("Line 200:");
    expect(output).not.toContain("Line 201:");
  });

  // --- 出力ファイルのディレクトリ自動作成 ---

  it("outputFile のディレクトリが存在しない場合に自動作成する", () => {
    fs.writeFileSync(commandFile, "# Command");
    const deepOutput = path.join(tmpDir, "nested", "prompt.txt");

    const result = composePrompt({ commandFile, outputFile: deepOutput });
    expect(result.success).toBe(true);
    expect(fs.existsSync(deepOutput)).toBe(true);
  });
});
