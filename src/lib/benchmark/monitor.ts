import type { MonitorOptions, MonitorResult, Phase0Config } from "./types.js";
import { capturePaneContent, sendKeys, paneExists } from "./tmux.js";
import { respondToPhase0 } from "./phase0-responder.js";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

function extractPermissionPath(paneContent: string): string | null {
  const lines = paneContent.split("\n");
  for (const line of lines) {
    if (line.includes("←")) {
      const match = line.match(/←\s*(\S+)/);
      if (match?.[1]) {
        return match[1];
      }
    }
  }
  return null;
}

function isPathSafe(path: string, projectRoot: string): boolean {
  if (!path.startsWith(projectRoot)) {
    return false;
  }
  if (/(?:^|\/)(?:lib|commands)\//.test(path)) {
    return false;
  }
  return true;
}

function loadPhase0Config(path: string): Phase0Config {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as Phase0Config;
}

function checkPipelineState(comboDir: string): {
  complete: boolean;
  error: boolean;
} {
  const statePath = `${comboDir}/pipeline-state.json`;
  if (!existsSync(statePath)) {
    return { complete: false, error: false };
  }

  try {
    const content = readFileSync(statePath, "utf-8");
    const state = JSON.parse(content) as {
      status?: string;
      current?: string | null;
      completed?: string[];
    };

    if (state.status === "completed") {
      return { complete: true, error: false };
    }
    if (state.status === "error") {
      return { complete: false, error: true };
    }
    if (state.current === null && state.completed && state.completed.length > 0) {
      return { complete: true, error: false };
    }

    return { complete: false, error: false };
  } catch {
    return { complete: false, error: false };
  }
}

function hasArtifacts(comboDir: string): boolean {
  try {
    const files = execSync(`find "${comboDir}" -maxdepth 2 -type f \\( -name "*.html" -o -name "*.js" -o -name "*.css" \\)`, {
      encoding: "utf-8",
    }).trim();
    return files.length > 0;
  } catch {
    return false;
  }
}

export async function runMonitor(options: MonitorOptions): Promise<MonitorResult> {
  const logs: string[] = [];
  const startTime = Date.now();
  const phase0Config = loadPhase0Config(options.phase0ConfigPath);

  let turnCount = 0;
  let phase0Done = false;
  let lastPipelineCheck = 0;
  let lastIdleCheck = 0;
  let idleDetected = false;

  const intervalMs = 10_000;
  const pipelineCheckIntervalMs = 60_000;
  const idleCheckStartMs = 120_000;
  const idleCheckIntervalMs = 60_000;

  while (true) {
    const elapsed = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsed / 1000);

    if (elapsedSeconds >= options.timeoutSeconds) {
      return {
        exitReason: "timeout",
        elapsedSeconds,
        combo: options.combo,
        logs: [...logs, `Timeout after ${elapsedSeconds}s`],
      };
    }

    if (!paneExists(options.targetPane)) {
      return {
        exitReason: "pane_lost",
        elapsedSeconds,
        combo: options.combo,
        logs: [...logs, "Pane no longer exists"],
      };
    }

    const paneContent = capturePaneContent(options.targetPane);

    if (!phase0Done) {
      const result = respondToPhase0(options.targetPane, phase0Config, turnCount);
      turnCount = result.turnCount;
      if (result.done) {
        phase0Done = true;
        logs.push(`Phase 0 max turns reached (${turnCount})`);
      }
      if (result.responded) {
        logs.push(`Phase 0 response sent (turn ${turnCount})`);
      }
    }

    if (paneContent.includes("Permission required")) {
      const permPath = extractPermissionPath(paneContent);
      if (permPath) {
        if (isPathSafe(permPath, options.projectRoot)) {
          logs.push(`Auto-approving permission: ${permPath}`);
          sendKeys(options.targetPane, "Right");
          await sleep(500);
          sendKeys(options.targetPane, "Enter");
          await sleep(500);
          sendKeys(options.targetPane, "y");
          await sleep(500);
          sendKeys(options.targetPane, "Enter");
        } else {
          logs.push(`Unsafe permission denied: ${permPath}`);
        }
      }
    }

    if (elapsed - lastPipelineCheck >= pipelineCheckIntervalMs) {
      lastPipelineCheck = elapsed;
      const pipelineState = checkPipelineState(options.comboDir);

      if (pipelineState.error) {
        return {
          exitReason: "pipeline_error",
          elapsedSeconds,
          combo: options.combo,
          logs: [...logs, "Pipeline error detected"],
        };
      }

      if (pipelineState.complete) {
        return {
          exitReason: "pipeline_complete",
          elapsedSeconds,
          combo: options.combo,
          logs: [...logs, "Pipeline completed"],
        };
      }
    }

    if (elapsed >= idleCheckStartMs && elapsed - lastIdleCheck >= idleCheckIntervalMs) {
      lastIdleCheck = elapsed;

      if (paneContent.includes(">")) {
        idleDetected = true;
        if (hasArtifacts(options.comboDir)) {
          return {
            exitReason: "tui_idle",
            elapsedSeconds,
            combo: options.combo,
            logs: [...logs, "TUI idle with artifacts present"],
          };
        }
        logs.push("TUI idle but no artifacts yet");
      }
    }

    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
