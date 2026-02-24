/**
 * plan-parser.ts
 *
 * Phase 0 Plan ファイルのパーサー + ヘルパー関数。
 * --init-from-plan CLI モードで使用。
 */

import type { FileSystem } from "./interfaces.js";

// --- 型定義 ---

export interface ParsedPlan {
  featureName: string;
  flow: string;
  pipeline: "proceed" | "skip";
  rawContent: string;
}

export interface ParsePlanResult {
  plan: ParsedPlan | null;
  errors: string[];
  warnings: string[];
}

// --- パーサー ---

/**
 * Plan ファイルの内容をパースする。
 *
 * パース戦略:
 * - `## ` ヘッダーでセクション分割、ヘッダー名を lowercase で正規化
 * - `## Feature name` → kebab-case 名。未指定時は `## Scope summary` の先頭5語からフォールバック
 * - `## Selected flow` → flow 名
 * - `## Pipeline` → proceed / skip。未指定時は proceed (warning 付き)
 */
export function parsePlanFile(content: string): ParsePlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sections = parseSections(content);

  // Flow (必須)
  const flowSection = sections.get("selected flow");
  const flow = flowSection?.trim() ?? "";
  if (!flow) {
    errors.push("Missing required section: ## Selected flow");
  }

  // Pipeline (任意、デフォルト proceed)
  const pipelineSection = sections.get("pipeline");
  let pipeline: "proceed" | "skip" = "proceed";
  if (pipelineSection) {
    const val = pipelineSection.trim().toLowerCase();
    if (val === "skip") {
      pipeline = "skip";
    } else if (val === "proceed") {
      pipeline = "proceed";
    } else {
      warnings.push(`Unknown pipeline value "${pipelineSection.trim()}", defaulting to "proceed"`);
    }
  } else {
    warnings.push('## Pipeline section not found, defaulting to "proceed"');
  }

  // Feature name (任意、フォールバック有り)
  let featureName = "";
  const nameSection = sections.get("feature name");
  if (nameSection?.trim()) {
    featureName = toKebabCase(nameSection.trim());
  }

  // Scope summary フォールバック
  if (!featureName) {
    const scopeSection = sections.get("scope summary");
    if (scopeSection?.trim()) {
      const words = scopeSection.trim().split(/\s+/).slice(0, 5).join(" ");
      featureName = toKebabCase(words);
    }
  }

  // 全非ASCII / 空文字列フォールバック
  if (!featureName) {
    const now = new Date();
    const pad = (n: number, w: number = 2) => String(n).padStart(w, "0");
    featureName = `feature-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  if (errors.length > 0) {
    return { plan: null, errors, warnings };
  }

  return {
    plan: {
      featureName,
      flow,
      pipeline,
      rawContent: content,
    },
    errors,
    warnings,
  };
}

// --- ヘルパー ---

/**
 * `## ` ヘッダーでセクション分割し、Map<lowercase header, body> を返す。
 */
function parseSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentHeader: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const match = /^##\s+(.+)$/.exec(line);
    if (match) {
      if (currentHeader !== null) {
        sections.set(currentHeader, currentBody.join("\n"));
      }
      currentHeader = match[1]!.toLowerCase().trim();
      currentBody = [];
    } else if (currentHeader !== null) {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    sections.set(currentHeader, currentBody.join("\n"));
  }

  return sections;
}

/**
 * 文字列を kebab-case に変換する。
 * lowercase → 非英数字・スペース以外除去 → スペース→ハイフン → 連続ハイフン統合。
 */
export function toKebabCase(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * features/ 内の `<NNN>-*` ディレクトリをスキャンし max+1 を返す。
 * `_runs/` 内は無視。features/ が存在しない場合は 1。
 */
export function resolveNextFeatureNumber(
  featuresDir: string,
  fs: Pick<FileSystem, "readdir" | "isDirectory">
): number {
  const entries = fs.readdir(featuresDir);
  let max = 0;
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    if (entry.name.startsWith("_")) continue;
    const match = /^(\d+)-/.exec(entry.name);
    if (match) {
      const num = parseInt(match[1]!, 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

/**
 * ParsedPlan から discussion-summary.md の内容を生成する。
 */
export function generateDiscussionSummary(plan: ParsedPlan): string {
  const sections = parseSections(plan.rawContent);
  const lines: string[] = [];

  lines.push(`# Discussion Summary`);
  lines.push("");
  lines.push(`- **Flow**: ${plan.flow}`);
  lines.push(`- **Feature**: ${plan.featureName}`);
  lines.push(`- **Pipeline**: ${plan.pipeline}`);
  lines.push("");

  const scopeSection = sections.get("scope summary");
  if (scopeSection?.trim()) {
    lines.push(`## Scope`);
    lines.push("");
    lines.push(scopeSection.trim());
    lines.push("");
  }

  const reqSection = sections.get("requirements");
  if (reqSection?.trim()) {
    lines.push(`## Requirements`);
    lines.push("");
    lines.push(reqSection.trim());
    lines.push("");
  }

  const techSection = sections.get("tech decisions");
  if (techSection?.trim()) {
    lines.push(`## Tech Decisions`);
    lines.push("");
    lines.push(techSection.trim());
    lines.push("");
  }

  return lines.join("\n");
}
