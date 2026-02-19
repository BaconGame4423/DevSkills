/**
 * PoorDev テスタブルインターフェース定義
 *
 * 副作用（git操作・ファイルシステム・ディスパッチ）をインターフェース経由で
 * 注入できるようにすることで、vitest でのモック置換を可能にする。
 *
 * tester 提案 + dependency-map.md §8 Git操作マップに基づく設計。
 */

import type { PipelineState } from "./types.js";

// --- GitOps ---

/**
 * git 操作インターフェース。
 *
 * pipeline-runner.sh の _safe_git() ラッパーに対応。
 * hasGitDir() は .git 存在チェック（FATAL guard）を分離したもの。
 * dependency-map.md §8 に記載された全操作をカバー。
 */
export interface GitOps {
  /** .git ディレクトリの存在確認（parent repo fallthrough 防止用） */
  hasGitDir(dir: string): boolean;

  /**
   * git コマンド実行。
   * 内部で hasGitDir を確認済みの前提で呼び出すこと。
   * 失敗時は Error をスロー。
   * @returns コマンドの stdout（trimmed）
   */
  git(dir: string, args: string[]): string;

  /**
   * git diff --name-only HEAD の出力を返す。
   * @returns 変更ファイルパス一覧（改行区切り）
   */
  diff(dir: string): string;
}

// --- FileSystem ---

/**
 * ファイルシステム操作インターフェース。
 * Node.js の fs モジュールの薄いラッパー。
 * dependency-map.md §7 ファイルシステム操作マップに対応。
 */
export interface FileSystem {
  /** ファイルを UTF-8 で読み取る。存在しない場合は Error をスロー */
  readFile(path: string): string;

  /** ファイルを UTF-8 で書き込む。ディレクトリは自動作成 */
  writeFile(path: string, content: string): void;

  /** パスが存在するかどうか確認 */
  exists(path: string): boolean;

  /** ファイルを削除する。存在しない場合はノーオペレーション */
  removeFile(path: string): void;

  /** ディレクトリを再帰的に削除 */
  removeDir(path: string): void;
}

// --- Dispatcher ---

/**
 * dispatch-step.sh 呼び出しインターフェース。
 * retry-helpers.sh の dispatch_with_retry から分離した最小単位の実行。
 *
 * @param step  ステップ名 (e.g. "specify", "implement")
 * @param projectDir プロジェクトルート
 * @param promptFile プロンプトファイルパス
 * @param idleTimeout アイドルタイムアウト（秒）
 * @param maxTimeout 最大タイムアウト（秒）
 * @param resultFile 結果 JSON の書き込み先
 * @returns exit code（0=成功、124=timeout、その他=エラー）
 */
export interface Dispatcher {
  dispatch(
    step: string,
    projectDir: string,
    promptFile: string,
    idleTimeout: number,
    maxTimeout: number,
    resultFile: string
  ): Promise<number>;
}

// --- PipelineStateManager ---

/**
 * pipeline-state.json の CRUD インターフェース。
 * pipeline-state.sh の全サブコマンドに1対1で対応。
 * dependency-map.md §4 pipeline-state.sh サブコマンド一覧を参照。
 */
export interface PipelineStateManager {
  /** pipeline-state.json を読み取る。存在しない場合は {} を返す */
  read(stateFile: string): PipelineState;

  /** pipeline-state.json を新規作成（上書き） */
  init(
    stateFile: string,
    flow: string,
    pipelineSteps: string[]
  ): PipelineState;

  /** ステップを completed に追加し、current を次へ進める */
  completeStep(stateFile: string, step: string): PipelineState;

  /** status と pauseReason を更新 */
  setStatus(
    stateFile: string,
    status: string,
    reason?: string
  ): PipelineState;

  /** variant と condition を設定 */
  setVariant(
    stateFile: string,
    variant: string,
    condition: unknown
  ): PipelineState;

  /** pendingApproval を設定し status を awaiting-approval に変更 */
  setApproval(
    stateFile: string,
    type: string,
    step: string
  ): PipelineState;

  /** pendingApproval をクリアし status を active に戻す */
  clearApproval(stateFile: string): PipelineState;

  /** pipeline を置換し current を再計算 */
  setPipeline(stateFile: string, pipelineSteps: string[]): PipelineState;

  /**
   * implement_phases_completed に phase_key を追記。
   * pipeline-state.sh のサブコマンドではなく、
   * pipeline-runner.sh の update_implement_phase_state() に対応。
   * code-trace.md §5-1 参照。
   */
  addImplementPhase(stateFile: string, phaseKey: string): PipelineState;

  /**
   * retries[] にリトライ記録を追記。
   * retry-helpers.sh の log_retry_attempt() に対応。
   * STATE_FILE が存在しない場合はノーオペレーション（ガード込み）。
   */
  logRetry(
    stateFile: string,
    step: string,
    attempt: number,
    exitCode: number,
    backoff: number
  ): void;
}
