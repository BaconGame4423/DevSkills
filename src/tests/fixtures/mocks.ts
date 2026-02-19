/**
 * テスト共通モックファクトリ
 *
 * GitOps / FileSystem / Dispatcher / PipelineStateManager を
 * vitest の vi.fn() で実装し、テストで再利用可能にする。
 */

import { vi } from "vitest";
import type { GitOps, FileSystem, Dispatcher, PipelineStateManager } from "../../lib/interfaces.js";
import type { PipelineState, PipelineStatus } from "../../lib/types.js";

// --- GitOps モック ---

export function makeGitOps(overrides?: Partial<GitOps>): GitOps {
  return {
    hasGitDir: vi.fn(() => true),
    git: vi.fn(() => ""),
    diff: vi.fn(() => ""),
    ...overrides,
  };
}

// --- FileSystem インメモリモック ---

export function makeFileSystem(initialFiles?: Record<string, string>): FileSystem {
  const store = new Map<string, string>(Object.entries(initialFiles ?? {}));
  return {
    readFile: vi.fn((p: string) => {
      if (!store.has(p)) throw new Error(`ENOENT: no such file or directory: ${p}`);
      return store.get(p)!;
    }),
    writeFile: vi.fn((p: string, c: string) => {
      store.set(p, c);
    }),
    exists: vi.fn((p: string) => store.has(p)),
    removeFile: vi.fn((p: string) => {
      store.delete(p);
    }),
    removeDir: vi.fn(),
    readdir: vi.fn(() => []),
  };
}

// --- Dispatcher モック ---

export function makeDispatcher(exitCode = 0): Dispatcher {
  return {
    dispatch: vi.fn(async () => exitCode),
  };
}

// --- PipelineStateManager モック ---

function makeInitialState(flow = "feature", steps: string[] = []): PipelineState {
  return {
    flow,
    variant: null,
    pipeline: steps,
    completed: [],
    current: steps[0] ?? null,
    status: "active",
    pauseReason: null,
    condition: null,
    pendingApproval: null,
    updated: new Date().toISOString(),
  };
}

export function makeStateManager(
  overrides?: Partial<PipelineStateManager>
): PipelineStateManager {
  let state: PipelineState = makeInitialState();

  const sm: PipelineStateManager = {
    read: vi.fn(() => ({ ...state })),
    init: vi.fn((sf: string, flow: string, steps: string[]) => {
      state = makeInitialState(flow, steps);
      return { ...state };
    }),
    completeStep: vi.fn((sf: string, step: string) => {
      const completed = [...new Set([...state.completed, step])];
      const completedSet = new Set(completed);
      const next = state.pipeline.find((s) => !completedSet.has(s)) ?? null;
      state = { ...state, completed, current: next };
      return { ...state };
    }),
    setStatus: vi.fn((sf: string, status: string, reason?: string) => {
      state = {
        ...state,
        status: status as PipelineStatus,
        pauseReason: reason ?? null,
      };
      return { ...state };
    }),
    setVariant: vi.fn((sf: string, variant: string, condition: unknown) => {
      state = { ...state, variant, condition };
      return { ...state };
    }),
    setApproval: vi.fn((sf: string, type: string, step: string) => {
      state = {
        ...state,
        status: "awaiting-approval",
        pendingApproval: { type, step },
        pauseReason: `${type} at ${step}`,
      };
      return { ...state };
    }),
    clearApproval: vi.fn(() => {
      state = {
        ...state,
        status: "active",
        pendingApproval: null,
        pauseReason: null,
      };
      return { ...state };
    }),
    setPipeline: vi.fn((sf: string, steps: string[]) => {
      const completedSet = new Set(state.completed);
      const next = steps.find((s) => !completedSet.has(s)) ?? null;
      state = { ...state, pipeline: steps, current: next };
      return { ...state };
    }),
    addImplementPhase: vi.fn((sf: string, phaseKey: string) => {
      const existing = state.implement_phases_completed ?? [];
      if (existing.includes(phaseKey)) return { ...state };
      state = {
        ...state,
        implement_phases_completed: [...existing, phaseKey],
      };
      return { ...state };
    }),
    logRetry: vi.fn(),
    ...overrides,
  };

  return sm;
}
