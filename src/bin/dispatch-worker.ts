#!/usr/bin/env node
/**
 * dispatch-worker CLI
 *
 * glm -p ラッパー。timeout + 自動リトライを内包。
 * LLM の裁量からコマンド構築を排除し、TS ヘルパーが生成した完全コマンドを実行する。
 *
 * Usage:
 *   node dist/bin/dispatch-worker.js \
 *     --prompt-file <path> \
 *     --append-system-prompt-file <agent-file> \
 *     --allowedTools "Read,Write,Edit,Bash,Grep,Glob" \
 *     --max-turns 30 \
 *     --result-file <path> \
 *     [--timeout 600] [--max-retries 1] [--retry-delay 30]
 */

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, openSync, closeSync } from "node:fs";
import path from "node:path";

// --- 型定義 ---

interface CliArgs {
  promptFile: string;
  appendSystemPromptFile: string;
  allowedTools: string;
  maxTurns: number;
  resultFile: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  cli: string;
  detach: boolean;
}

interface FailureResult {
  status: "failed";
  exitCode: number;
  attempts: number;
  lastError: string;
}

// --- 引数パース ---

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    promptFile: "",
    appendSystemPromptFile: "",
    allowedTools: "Read,Write,Edit,Bash,Grep,Glob",
    maxTurns: 30,
    resultFile: "",
    timeout: 600,
    maxRetries: 1,
    retryDelay: 30,
    cli: "glm",
    detach: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    switch (arg) {
      case "--prompt-file":
        args.promptFile = next ?? "";
        i++;
        break;
      case "--append-system-prompt-file":
        args.appendSystemPromptFile = next ?? "";
        i++;
        break;
      case "--allowedTools":
        args.allowedTools = next ?? "";
        i++;
        break;
      case "--max-turns":
        args.maxTurns = parseInt(next ?? "30", 10);
        i++;
        break;
      case "--result-file":
        args.resultFile = next ?? "";
        i++;
        break;
      case "--timeout":
        args.timeout = parseInt(next ?? "600", 10);
        i++;
        break;
      case "--max-retries":
        args.maxRetries = parseInt(next ?? "1", 10);
        i++;
        break;
      case "--retry-delay":
        args.retryDelay = parseInt(next ?? "30", 10);
        i++;
        break;
      case "--cli":
        args.cli = next ?? "glm";
        i++;
        break;
      case "--detach":
        args.detach = true;
        break;
    }
  }
  return args;
}

// --- ヘルパー ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runWorker(
  prompt: string,
  args: CliArgs,
  timeoutSec: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    // worker CLI の CLAUDECODE unset と defense-in-depth
    delete env.CLAUDECODE;

    const workerArgs = [
      String(timeoutSec),
      args.cli,
      "-p",
      prompt,
      "--append-system-prompt-file",
      args.appendSystemPromptFile,
      "--allowedTools",
      args.allowedTools,
      "--output-format",
      "json",
      "--max-turns",
      String(args.maxTurns),
    ];

    const child = spawn("timeout", workerArgs, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });

    child.on("error", (err) => {
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: err.message,
      });
    });
  });
}

// --- メイン ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.promptFile) {
    process.stderr.write("Error: --prompt-file is required\n");
    process.exit(2);
  }
  if (!args.resultFile) {
    process.stderr.write("Error: --result-file is required\n");
    process.exit(2);
  }

  // --detach モード: 自身を detached 子プロセスとして再起動し、即座に exit
  if (args.detach) {
    // compaction 後の重複起動防止: .pid ファイルが存在し、プロセスが生存中ならスキップ
    const pidFile = `${args.resultFile}.pid`;
    if (existsSync(pidFile)) {
      try {
        const existingPid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
        process.kill(existingPid, 0); // 生存確認（シグナルは送らない）
        process.stderr.write(
          `[dispatch-worker] Already running: PID=${existingPid} (skipping spawn)\n`,
        );
        process.exit(0);
      } catch {
        // プロセスが存在しない → .pid ファイルは stale。続行して新しいワーカーを起動
        process.stderr.write(
          `[dispatch-worker] Stale PID file found, spawning new worker\n`,
        );
      }
    }

    // result-file が既に存在する場合はワーカー完了済み → スキップ
    if (existsSync(args.resultFile)) {
      process.stderr.write(
        `[dispatch-worker] Result file already exists (worker completed), skipping spawn\n`,
      );
      process.exit(0);
    }

    const childArgs = process.argv.slice(2).filter((a) => a !== "--detach");
    const child = spawn(process.execPath, [process.argv[1]!, ...childArgs], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    writeFileSync(pidFile, String(child.pid));
    process.stderr.write(
      `[dispatch-worker] Detached: PID=${child.pid}\n`,
    );
    process.exit(0);
  }

  let prompt: string;
  try {
    prompt = readFileSync(args.promptFile, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error reading prompt file: ${msg}\n`);
    process.exit(2);
  }

  const totalAttempts = args.maxRetries + 1;
  let lastExitCode = 1;
  let lastError = "unknown";

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    process.stderr.write(
      `[dispatch-worker] Attempt ${attempt}/${totalAttempts} (timeout=${args.timeout}s)\n`,
    );

    const result = await runWorker(prompt, args, args.timeout);
    lastExitCode = result.exitCode;

    // stderr を透過出力（デバッグ用）
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.exitCode === 0) {
      // 成功: result-file に stdout を書き込み
      writeFileSync(args.resultFile, result.stdout, "utf-8");
      try { unlinkSync(`${args.resultFile}.pid`); } catch { /* ignore */ }
      process.exit(0);
    }

    // 失敗の分類
    if (result.exitCode === 124) {
      lastError = "timeout";
    } else {
      lastError = `exit_code_${result.exitCode}`;
    }

    process.stderr.write(
      `[dispatch-worker] Attempt ${attempt} failed: ${lastError}\n`,
    );

    // リトライ可能な場合は delay 後に再実行
    if (attempt < totalAttempts) {
      process.stderr.write(
        `[dispatch-worker] Retrying in ${args.retryDelay}s...\n`,
      );
      await sleep(args.retryDelay * 1000);
    }
  }

  // 全リトライ失敗: result-file にエラー JSON を書き込み
  const failure: FailureResult = {
    status: "failed",
    exitCode: lastExitCode,
    attempts: totalAttempts,
    lastError,
  };
  writeFileSync(args.resultFile, JSON.stringify(failure, null, 2), "utf-8");
  try { unlinkSync(`${args.resultFile}.pid`); } catch { /* ignore */ }
  process.exit(1);
}

main();
