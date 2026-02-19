/**
 * intake.test.ts
 *
 * generateShortName() の単体テスト。
 * intake.ts (intake.sh TS 移植) のカバレッジ。
 */

import { describe, it, expect } from "vitest";
import { generateShortName } from "../lib/intake.js";

// ================================================================
// generateShortName
// ================================================================

describe("generateShortName", () => {
  it("英語テキスト → 最初の4単語をハイフン結合", () => {
    const result = generateShortName("Add user authentication feature", "feature");
    // bash の cut -c1-30 相当で30文字に切り詰められる
    expect(result).toBe("add-user-authentication-featur");
  });

  it("5単語以上 → 最初の4単語のみ", () => {
    const result = generateShortName("Fix the login button click handler issue", "bugfix");
    expect(result).toBe("fix-the-login-button");
  });

  it("30文字以上 → 30文字に切り詰める", () => {
    const result = generateShortName("Implement very long feature name that exceeds thirty chars", "feature");
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("特殊文字を除去する", () => {
    const result = generateShortName("Add [feature] for (user) & group!", "feature");
    // 特殊文字除去後: "Add feature for user  group"
    expect(result).not.toContain("[");
    expect(result).not.toContain("]");
    expect(result).not.toContain("(");
    expect(result).not.toContain("!");
    expect(result).not.toContain("&");
  });

  it("小文字化される", () => {
    const result = generateShortName("Add User Authentication", "feature");
    expect(result).toBe(result.toLowerCase());
  });

  it("空文字入力 → flow + 時刻のフォールバック", () => {
    const result = generateShortName("", "feature");
    expect(result).toMatch(/^feature-\d{6}$/);
  });

  it("特殊文字のみの入力 → flow + 時刻のフォールバック", () => {
    const result = generateShortName("!!! @#$%", "bugfix");
    expect(result).toMatch(/^bugfix-\d{6}$/);
  });

  it("日本語テキスト → 除去後に空になる場合はフォールバック", () => {
    const result = generateShortName("新機能追加", "feature");
    // 日本語は英数字以外なので除去され空になる
    expect(result).toMatch(/^feature-\d{6}$/);
  });

  it("1単語のみ → その単語をそのまま使う", () => {
    const result = generateShortName("Authentication", "feature");
    expect(result).toBe("authentication");
  });

  it("数字を含む入力 → 数字は保持される", () => {
    const result = generateShortName("Fix issue 123 in login", "bugfix");
    expect(result).toContain("123");
  });
});
