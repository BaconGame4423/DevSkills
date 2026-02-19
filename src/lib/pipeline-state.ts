/**
 * pipeline-state.ts
 *
 * pipeline-state.sh の TypeScript 移植。
 * PipelineStateManager インターフェースの実装。
 *
 * 主な変更点:
 * - jq による JSON 操作 → TypeScript のオブジェクト操作
 * - サブコマンド CLI → メソッド呼び出し
 * - addImplementPhase / logRetry は sh 版では別コードパスだったが、
 *   一貫性のため PipelineStateManager に統合
 *
 * code-trace.md §5 参照。
 */

import type { PipelineStateManager } from "./interfaces.js";
import type {
  PipelineState,
  PipelineStatus,
  PendingApproval,
  RetryRecord,
} from "./types.js";
import type { FileSystem } from "./interfaces.js";

// --- FilePipelineStateManager ---

export class FilePipelineStateManager implements PipelineStateManager {
  constructor(private readonly fs: FileSystem) {}

  // --- private helpers ---

  private readRaw(stateFile: string): PipelineState | null {
    if (!this.fs.exists(stateFile)) return null;
    try {
      const content = this.fs.readFile(stateFile);
      return JSON.parse(content) as PipelineState;
    } catch {
      return null;
    }
  }

  private write(stateFile: string, state: PipelineState): PipelineState {
    this.fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    return state;
  }

  private now(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
  }

  /**
   * pipeline[] の中で completed に含まれない最初のステップ。
   * complete-step / set-pipeline の current 計算ロジック。
   * pipeline-state.sh の jq 式に対応。
   * code-trace.md §5-3 参照。
   */
  private calcCurrent(
    pipeline: string[],
    completed: string[]
  ): string | null {
    const completedSet = new Set(completed);
    return pipeline.find((s) => !completedSet.has(s)) ?? null;
  }

  // --- PipelineStateManager 実装 ---

  read(stateFile: string): PipelineState {
    return this.readRaw(stateFile) ?? ({} as PipelineState);
  }

  init(stateFile: string, flow: string, pipelineSteps: string[]): PipelineState {
    const firstStep = pipelineSteps[0] ?? null;
    const state: PipelineState = {
      flow,
      variant: null,
      pipeline: pipelineSteps,
      completed: [],
      current: firstStep,
      status: "active",
      pauseReason: null,
      condition: null,
      pendingApproval: null,
      updated: this.now(),
    };
    return this.write(stateFile, state);
  }

  completeStep(stateFile: string, step: string): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const completed = [...new Set([...(state.completed ?? []), step])];
    const next = this.calcCurrent(state.pipeline ?? [], completed);
    const updated: PipelineState = {
      ...state,
      completed,
      current: next,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  setStatus(
    stateFile: string,
    status: string,
    reason?: string
  ): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const updated: PipelineState = {
      ...state,
      status: status as PipelineStatus,
      pauseReason: reason ?? null,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  setVariant(
    stateFile: string,
    variant: string,
    condition: unknown
  ): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const updated: PipelineState = {
      ...state,
      variant,
      condition,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  setApproval(stateFile: string, type: string, step: string): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const pendingApproval: PendingApproval = { type, step };
    const updated: PipelineState = {
      ...state,
      status: "awaiting-approval",
      pauseReason: `${type} at ${step}`,
      pendingApproval,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  clearApproval(stateFile: string): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const updated: PipelineState = {
      ...state,
      status: "active",
      pendingApproval: null,
      pauseReason: null,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  setPipeline(stateFile: string, pipelineSteps: string[]): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const next = this.calcCurrent(pipelineSteps, state.completed ?? []);
    const updated: PipelineState = {
      ...state,
      pipeline: pipelineSteps,
      current: next,
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  /**
   * implement_phases_completed に phase_key を追記する。
   * pipeline-runner.sh の update_implement_phase_state() に対応。
   * code-trace.md §5-1: 動的フィールド（init スキーマ外）。
   */
  addImplementPhase(stateFile: string, phaseKey: string): PipelineState {
    const state = this.readRaw(stateFile) ?? ({} as PipelineState);
    const existing = state.implement_phases_completed ?? [];
    if (existing.includes(phaseKey)) {
      // 既に存在する場合はノーオペレーション（unique 保証）
      return state;
    }
    const updated: PipelineState = {
      ...state,
      implement_phases_completed: [...existing, phaseKey],
      updated: this.now(),
    };
    return this.write(stateFile, updated);
  }

  /**
   * retries[] にリトライ記録を追記する。
   * retry-helpers.sh の log_retry_attempt() に対応。
   *
   * STATE_FILE が存在しない場合はノーオペレーション。
   * code-trace.md §3-3 参照: review-runner サブシェルでは STATE_FILE 未設定のため
   * このメソッドが呼ばれても stateFile 存在チェックで弾く設計。
   */
  logRetry(
    stateFile: string,
    step: string,
    attempt: number,
    exitCode: number,
    backoff: number
  ): void {
    // STATE_FILE が存在しない場合はスキップ（元の Bash ガードと同じ）
    if (!this.fs.exists(stateFile)) return;

    const state = this.readRaw(stateFile);
    if (!state) return;

    const record: RetryRecord = {
      step,
      attempt,
      exit_code: exitCode,
      backoff,
      ts: this.now(),
    };

    const updated: PipelineState = {
      ...state,
      retries: [...(state.retries ?? []), record],
    };
    this.write(stateFile, updated);
  }
}
