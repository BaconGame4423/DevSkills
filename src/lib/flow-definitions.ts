/**
 * flow-definitions.ts
 *
 * ビルトインフロー定義 + BUILTIN_FLOWS レジストリ。
 * pipeline-runner.ts の FLOW_STEPS / REVIEW_STEPS / CONDITIONAL_STEPS /
 * checkPrerequisites() / contextArgsForStep() を宣言的に置換する。
 */

import type { FlowDefinition, StepTeamConfig } from "./flow-types.js";

// --- 共通レビュー teamConfig ---

const PLANREVIEW_TEAM: StepTeamConfig = {
  type: "review-loop",
  teammates: [
    { role: "reviewer-plan-unified", writeAccess: false },
    { role: "review-fixer" },
  ],
  maxReviewIterations: 6,
  reviewCommunication: "opus-mediated",
};

const TASKSREVIEW_TEAM: StepTeamConfig = {
  type: "review-loop",
  teammates: [
    { role: "reviewer-tasks-unified", writeAccess: false },
    { role: "review-fixer" },
  ],
  maxReviewIterations: 6,
  reviewCommunication: "opus-mediated",
};

const ARCH_REVIEW_TEAM: StepTeamConfig = {
  type: "review-loop",
  teammates: [
    { role: "reviewer-arch-unified", writeAccess: false },
    { role: "review-fixer" },
  ],
  maxReviewIterations: 8,
  reviewCommunication: "opus-mediated",
};

const QUALITY_REVIEW_TEAM: StepTeamConfig = {
  type: "review-loop",
  teammates: [
    { role: "reviewer-quality-unified", writeAccess: false },
    { role: "review-fixer" },
  ],
  maxReviewIterations: 8,
  reviewCommunication: "opus-mediated",
};

const PHASE_REVIEW_TEAM: StepTeamConfig = {
  type: "review-loop",
  teammates: [
    { role: "reviewer-phase-unified", writeAccess: false },
    { role: "review-fixer" },
  ],
  maxReviewIterations: 6,
  reviewCommunication: "opus-mediated",
};

// --- Feature Flow ---

export const FEATURE_FLOW: FlowDefinition = {
  description: "仕様→計画→実装→レビューの10ステップ",
  steps: [
    "specify", "plan", "planreview",
    "tasks", "tasksreview", "implement", "testdesign",
    "architecturereview", "qualityreview", "phasereview",
  ],
  reviews: [
    "planreview", "tasksreview",
    "architecturereview", "qualityreview", "phasereview",
  ],
  conditionals: [],
  context: {
    specify:   { input: "input.txt", discussion: "discussion-summary.md" },
    plan:      { spec: "spec.md" },
    tasks:     { plan: "plan.md", spec: "spec.md" },
    implement: { tasks: "tasks.md", plan: "plan.md" },
    testdesign: { spec: "spec.md", plan: "plan.md", tasks: "tasks.md", implementation: "*" },
    planreview:  { plan: "plan.md", spec: "spec.md" },
    tasksreview: { tasks: "tasks.md", spec: "spec.md", plan: "plan.md" },
    architecturereview: { spec: "spec.md" },
    qualityreview:      { spec: "spec.md" },
    phasereview:        { spec: "spec.md" },
  },
  contextInject: {
    plan:      { spec: true },
    tasks:     { spec: true },
    implement: {},
    testdesign: { spec: true },
    planreview:  { spec: true },
    tasksreview: { spec: true },
    architecturereview: { spec: true },
    qualityreview:      { spec: true },
    phasereview:        { spec: true },
  },
  prerequisites: {
    plan: ["spec.md"],
    tasks: ["plan.md", "spec.md"],
    implement: ["tasks.md", "spec.md"],
  },
  artifacts: {
    specify: "spec.md",
    plan: "plan.md",
    tasks: "tasks.md",
    testdesign: "test-plan.md",
    implement: "*",
  },
  reviewPersonaGroups: {
    planreview: "planreview",
    tasksreview: "tasksreview",
    architecturereview: "architecturereview",
    qualityreview: "qualityreview",
    phasereview: "phasereview",
  },
  reviewTargets: {
    architecturereview: "*",
    qualityreview: "*",
    phasereview: "*",
  },
  discussionSteps: ["discussion"],
  teamConfig: {
    specify:  { type: "team", teammates: [{ role: "worker-specify" }] },
    plan:     { type: "team", teammates: [{ role: "worker-plan" }] },
    planreview: PLANREVIEW_TEAM,
    tasks:       { type: "team", teammates: [{ role: "worker-tasks" }] },
    tasksreview: TASKSREVIEW_TEAM,
    implement:   { type: "team", teammates: [{ role: "worker-implement" }] },
    testdesign:  { type: "team", teammates: [{ role: "worker-testdesign" }] },
    architecturereview: ARCH_REVIEW_TEAM,
    qualityreview: QUALITY_REVIEW_TEAM,
    phasereview: PHASE_REVIEW_TEAM,
  },
  conditionalBranches: {},
};

// --- Bugfix Flow ---

export const BUGFIX_FLOW: FlowDefinition = {
  description: "調査→分類→修正のバグ修正フロー",
  steps: ["bugfix"],
  conditionals: ["bugfix"],
  context: {
    bugfix: { bug_report: "bug-report.md" },
  },
  teamConfig: {
    bugfix:       { type: "team", teammates: [{ role: "worker-bugfix" }] },
    plan:         { type: "team", teammates: [{ role: "worker-plan" }] },
    planreview:   PLANREVIEW_TEAM,
    tasks:        { type: "team", teammates: [{ role: "worker-tasks" }] },
    tasksreview:  TASKSREVIEW_TEAM,
    implement:    { type: "team", teammates: [{ role: "worker-implement" }] },
    architecturereview: ARCH_REVIEW_TEAM,
    qualityreview:      QUALITY_REVIEW_TEAM,
    phasereview:        PHASE_REVIEW_TEAM,
  },
  conditionalBranches: {
    "bugfix:RECLASSIFY_FEATURE": {
      pattern: "\\[RECLASSIFY: FEATURE\\]",
      action: "pause",
      pauseReason: "Reclassified as feature",
    },
    "bugfix:SCALE_SMALL": {
      pattern: "\\[SCALE: SMALL\\]",
      action: "replace-pipeline",
      pipeline: ["bugfix", "planreview", "implement", "qualityreview", "phasereview"],
      variant: "bugfix-small",
    },
    "bugfix:SCALE_LARGE": {
      pattern: "\\[SCALE: LARGE\\]",
      action: "replace-pipeline",
      pipeline: [
        "bugfix", "plan", "planreview", "tasks", "tasksreview",
        "implement", "architecturereview", "qualityreview", "phasereview",
      ],
      variant: "bugfix-large",
    },
  },
};

// --- Roadmap Flow ---

export const ROADMAP_FLOW: FlowDefinition = {
  description: "コンセプト→ゴール→マイルストーン→ロードマップの4ステップ",
  steps: ["concept", "goals", "milestones", "roadmap"],
  context: {
    concept: { spec: "spec.md" },
    goals: { spec: "spec.md" },
    milestones: { spec: "spec.md" },
    roadmap: { spec: "spec.md" },
  },
  teamConfig: {
    concept:    { type: "team", teammates: [{ role: "worker-concept" }] },
    goals:      { type: "team", teammates: [{ role: "worker-goals" }] },
    milestones: { type: "team", teammates: [{ role: "worker-milestones" }] },
    roadmap:    { type: "team", teammates: [{ role: "worker-roadmap" }] },
  },
};

// --- Discovery Init Flow ---

export const DISCOVERY_INIT_FLOW: FlowDefinition = {
  description: "まず作って学ぶ探索フロー",
  steps: ["discovery"],
  teamConfig: {
    discovery: { type: "team", teammates: [{ role: "worker-discovery" }] },
  },
};

// --- Discovery Rebuild Flow ---

export const DISCOVERY_REBUILD_FLOW: FlowDefinition = {
  description: "プロトタイプ評価→再構築判定",
  steps: ["rebuildcheck"],
  conditionals: ["rebuildcheck"],
  teamConfig: {
    rebuildcheck: { type: "team", teammates: [{ role: "worker-rebuildcheck" }] },
    harvest:      { type: "team", teammates: [{ role: "worker-harvest" }] },
    plan:         { type: "team", teammates: [{ role: "worker-plan" }] },
    planreview:   PLANREVIEW_TEAM,
    tasks:        { type: "team", teammates: [{ role: "worker-tasks" }] },
    tasksreview:  TASKSREVIEW_TEAM,
    implement:    { type: "team", teammates: [{ role: "worker-implement" }] },
    architecturereview: ARCH_REVIEW_TEAM,
    qualityreview:      QUALITY_REVIEW_TEAM,
    phasereview:        PHASE_REVIEW_TEAM,
  },
  conditionalBranches: {
    "rebuildcheck:REBUILD": {
      pattern: "\\[VERDICT: REBUILD\\]",
      action: "replace-pipeline",
      pipeline: [
        "rebuildcheck", "harvest", "plan", "planreview",
        "tasks", "tasksreview", "implement",
        "architecturereview", "qualityreview", "phasereview",
      ],
      variant: "discovery-rebuild",
    },
    "rebuildcheck:CONTINUE": {
      pattern: "\\[VERDICT: CONTINUE\\]",
      action: "pause",
      variant: "discovery-continue",
      pauseReason: "CONTINUE verdict",
    },
  },
};

// --- Investigation Flow ---

export const INVESTIGATION_FLOW: FlowDefinition = {
  description: "問題調査・分析フロー",
  steps: ["investigate"],
  teamConfig: {
    investigate: { type: "team", teammates: [{ role: "worker-investigate" }] },
  },
};

// --- Registry ---

export const BUILTIN_FLOWS: Record<string, FlowDefinition> = {
  feature: FEATURE_FLOW,
  bugfix: BUGFIX_FLOW,
  roadmap: ROADMAP_FLOW,
  "discovery-init": DISCOVERY_INIT_FLOW,
  "discovery-rebuild": DISCOVERY_REBUILD_FLOW,
  investigation: INVESTIGATION_FLOW,
};

/** ビルトインフロー定義を取得。見つからなければ null。 */
export function getFlowDefinition(flowName: string): FlowDefinition | null {
  return BUILTIN_FLOWS[flowName] ?? null;
}
