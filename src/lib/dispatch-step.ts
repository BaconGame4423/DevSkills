/**
 * dispatch-step.ts
 *
 * dispatch-step.sh の TypeScript 移植。
 * Dispatcher インターフェースの本番実装。
 *
 * 主な変更点:
 * - 一時コマンドファイル生成 → コマンドを直接組み立てて spawn
 * - config-resolver.sh (外部プロセス) → resolveCli() でインライン解決
 * - poll-dispatch.sh → pollDispatch() 関数呼び出し
 * - output ファイルは /tmp/poor-dev-output-{step}-{pid}-{ts}.txt に書き込み
 *   (review-runner.ts の prefix 検索との互換性維持)
 *
 * code-trace-p2p4.md §4 参照。
 */

import path from "node:path";
import fs from "node:fs";

import type { Dispatcher } from "./interfaces.js";
import { pollDispatch, type SpawnSpec, type PollOptions } from "./poll-dispatch.js";

// --- 型定義 ---

interface ResolvedCli {
  cli: "opencode" | "claude";
  model: string;
}

// config.json の型 (最小限)
interface ConfigShape {
  overrides?: Record<string, { cli?: string; model?: string }>;
  step_tiers?: Record<string, string>;
  tiers?: Record<string, { cli?: string; model?: string }>;
  default?: { cli?: string; model?: string };
}

// --- config-resolver のインライン実装 ---

/**
 * config.json から CLI / model を解決する。
 * config-resolver.sh の 5-level resolution chain に対応:
 *   1. overrides.<step>
 *   2. overrides.<category>  (ステップ最後のハイフン区切りを除去)
 *   3. step_tiers.<step> → tiers[tier]
 *   4. default
 *   5. hardcoded: {cli:"claude", model:"sonnet"}
 *
 * code-trace-p2p4.md §4-2 参照。
 */
export function resolveCli(step: string, configPath: string): ResolvedCli {
  const HARDCODED: ResolvedCli = { cli: "claude", model: "sonnet" };

  let config: ConfigShape = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8")) as ConfigShape;
    }
  } catch {
    return HARDCODED;
  }

  // category: 最後のハイフン区切りを除去 (例: planreview-pm → planreview)
  const category = step.includes("-") ? step.replace(/-[^-]*$/, "") : step;

  function extract(obj: { cli?: string; model?: string } | undefined): ResolvedCli | null {
    if (!obj?.cli) return null;
    const cli = obj.cli === "opencode" ? "opencode" : "claude";
    return { cli, model: obj.model ?? "sonnet" };
  }

  // Level 1: overrides.<step>
  const r1 = extract(config.overrides?.[step]);
  if (r1) return r1;

  // Level 2: overrides.<category>
  const r2 = extract(config.overrides?.[category]);
  if (r2) return r2;

  // Level 3: step_tiers.<step> → tiers[tier_name]
  if (config.step_tiers?.[step] && config.tiers) {
    const tier = config.step_tiers[step];
    const r3 = extract(config.tiers[tier]);
    if (r3) return r3;
  }

  // Level 4: default
  const r4 = extract(config.default);
  if (r4) return r4;

  // Level 5: hardcoded
  return HARDCODED;
}

// --- NodeDispatcher ---

/**
 * Dispatcher インターフェースの本番実装。
 * dispatch-step.sh の動作を TypeScript で再現する。
 *
 * review-runner.ts との互換性:
 *   ペルソナ出力を /tmp/poor-dev-output-{step}-{pid}-{ts}.txt に書き込む。
 *   review-runner.ts の dispatchPersona() (L365-376) がこのプレフィックスで検索する。
 */
export class NodeDispatcher implements Dispatcher {
  async dispatch(
    step: string,
    projectDir: string,
    promptFile: string,
    idleTimeout: number,
    maxTimeout: number,
    resultFile: string
  ): Promise<number> {
    // --- バリデーション (dispatch-step.sh L29-37) ---

    if (!fs.existsSync(projectDir)) {
      const errResult = {
        exit_code: 1,
        elapsed: 0,
        timeout_type: "none",
        verdict: null,
        errors: [`Project directory not found: ${projectDir}`],
        clarifications: [],
      };
      if (resultFile) {
        try { fs.writeFileSync(resultFile, JSON.stringify(errResult), "utf8"); } catch { /* ignore */ }
      }
      return 1;
    }

    if (!fs.existsSync(promptFile)) {
      const errResult = {
        exit_code: 1,
        elapsed: 0,
        timeout_type: "none",
        verdict: null,
        errors: [`Prompt file not found: ${promptFile}`],
        clarifications: [],
      };
      if (resultFile) {
        try { fs.writeFileSync(resultFile, JSON.stringify(errResult), "utf8"); } catch { /* ignore */ }
      }
      return 1;
    }

    // --- CLI / model 解決 (dispatch-step.sh L39-53) ---

    const configPath = path.join(projectDir, ".poor-dev", "config.json");
    const { cli, model } = resolveCli(step, configPath);

    // --- コマンド組み立て (dispatch-step.sh L61-78) ---

    let promptContent: string;
    try {
      promptContent = fs.readFileSync(promptFile, "utf8");
    } catch (err) {
      const errResult = {
        exit_code: 1,
        elapsed: 0,
        timeout_type: "none",
        verdict: null,
        errors: [`Failed to read prompt file: ${String(err)}`],
        clarifications: [],
      };
      if (resultFile) {
        try { fs.writeFileSync(resultFile, JSON.stringify(errResult), "utf8"); } catch { /* ignore */ }
      }
      return 1;
    }

    let spawnSpec: SpawnSpec;

    if (cli === "opencode") {
      // opencode run --model $MODEL --format json "$PROMPT_CONTENT"
      // dispatch-step.sh L63-65 に対応
      spawnSpec = {
        cmd: "opencode",
        args: ["run", "--model", model, "--format", "json", promptContent],
        cwd: projectDir,
        // opencode は stdin 不要
      };
    } else {
      // cat $PROMPT_FILE | claude -p --model $MODEL --no-session-persistence ...
      // dispatch-step.sh L69-71 に対応 (stdin piping)
      spawnSpec = {
        cmd: "claude",
        args: [
          "-p",
          "--model", model,
          "--no-session-persistence",
          "--output-format", "text",
          "--dangerously-skip-permissions",
        ],
        cwd: projectDir,
        stdinContent: promptContent,
      };
    }

    // review-runner.ts の prefix 検索との互換性用 output ファイル
    // (code-trace-p2p4.md §9-6)
    spawnSpec.outputFile = `/tmp/poor-dev-output-${step}-${process.pid}-${Date.now()}.txt`;

    // --- poll-dispatch 実行 ---

    const pollOpts: PollOptions = {
      idleTimeout,
      maxTimeout,
      stepName: step,
      ...(resultFile ? { resultFile } : {}),
    };

    const result = await pollDispatch(spawnSpec, pollOpts);
    return result.exitCode;
  }
}
