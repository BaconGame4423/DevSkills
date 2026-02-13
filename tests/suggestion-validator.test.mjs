import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateMaintainabilityScore,
  calculateSecurityScore,
  filterByThreshold,
  applyWarningMarkers
} from '../lib/suggestion-validator.mjs';

describe('calculateMaintainabilityScore', () => {
  it('should return high score for high quality project', () => {
    const params = {
      commitRecencyMonths: 3,
      issueResolutionRate: 95,
      activeContributors: 8,
      hasCompleteDocs: true,
      hasExamples: true
    };

    const score = calculateMaintainabilityScore(params);
    assert.ok(score >= 90, `Expected score >= 90, got ${score}`);
  });

  it('should return low score for low quality project', () => {
    const params = {
      commitRecencyMonths: 24,
      issueResolutionRate: 30,
      activeContributors: 0,
      hasCompleteDocs: false,
      hasExamples: false
    };

    const score = calculateMaintainabilityScore(params);
    assert.ok(score < 50, `Expected score < 50, got ${score}`);
  });

  it('should return medium score for moderate quality project', () => {
    const params = {
      commitRecencyMonths: 10,
      issueResolutionRate: 65,
      activeContributors: 2,
      hasCompleteDocs: true,
      hasExamples: false
    };

    const score = calculateMaintainabilityScore(params);
    assert.ok(score >= 50 && score < 90, `Expected 50 <= score < 90, got ${score}`);
  });

  it('should handle edge case with very recent commits', () => {
    const params = {
      commitRecencyMonths: 0,
      issueResolutionRate: 100,
      activeContributors: 10,
      hasCompleteDocs: true,
      hasExamples: true
    };

    const score = calculateMaintainabilityScore(params);
    assert.ok(score === 100, `Expected score 100, got ${score}`);
  });

  it('should cap score at 100', () => {
    const params = {
      commitRecencyMonths: 0,
      issueResolutionRate: 100,
      activeContributors: 20,
      hasCompleteDocs: true,
      hasExamples: true
    };

    const score = calculateMaintainabilityScore(params);
    assert.ok(score <= 100, `Expected score <= 100, got ${score}`);
  });
});

describe('calculateSecurityScore', () => {
  it('should return high score for secure project with no CVEs', () => {
    const params = {
      criticalCVEs: 0,
      nonCriticalCVEs: 0,
      hasRecentAudit: true,
      hasOldAudit: false,
      allDepsUpToDate: true,
      someOutdated: false,
      hasHighCoverage: true,
      hasLinter: true
    };

    const score = calculateSecurityScore(params);
    assert.ok(score >= 90, `Expected score >= 90, got ${score}`);
  });

  it('should return low score for critical CVEs', () => {
    const params = {
      criticalCVEs: 2,
      nonCriticalCVEs: 3,
      hasRecentAudit: false,
      hasOldAudit: false,
      allDepsUpToDate: false,
      someOutdated: true,
      hasHighCoverage: false,
      hasLinter: false
    };

    const score = calculateSecurityScore(params);
    assert.ok(score < 50, `Expected score < 50, got ${score}`);
  });

  it('should return medium score with some non-critical CVEs', () => {
    const params = {
      criticalCVEs: 0,
      nonCriticalCVEs: 2,
      hasRecentAudit: false,
      hasOldAudit: true,
      allDepsUpToDate: false,
      someOutdated: true,
      hasHighCoverage: true,
      hasLinter: false
    };

    const score = calculateSecurityScore(params);
    assert.ok(score >= 40 && score < 90, `Expected 40 <= score < 90, got ${score}`);
  });

  it('should heavily penalize critical CVEs', () => {
    const params = {
      criticalCVEs: 1,
      nonCriticalCVEs: 0,
      hasRecentAudit: true,
      hasOldAudit: false,
      allDepsUpToDate: true,
      someOutdated: false,
      hasHighCoverage: true,
      hasLinter: true
    };

    const score = calculateSecurityScore(params);
    assert.ok(score <= 60, `Expected score <= 60 with critical CVE, got ${score}`);
  });
});

describe('filterByThreshold', () => {
  it('should filter out suggestions with scores below 50', () => {
    const suggestions = [
      { name: 'good', maintainabilityScore: 80, securityScore: 85 },
      { name: 'low-maint', maintainabilityScore: 40, securityScore: 90 },
      { name: 'low-sec', maintainabilityScore: 85, securityScore: 35 },
      { name: 'both-low', maintainabilityScore: 30, securityScore: 25 }
    ];

    const filtered = filterByThreshold(suggestions);

    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].name, 'good');
  });

  it('should pass suggestions with scores at threshold (50)', () => {
    const suggestions = [
      { name: 'edge-case', maintainabilityScore: 50, securityScore: 50 }
    ];

    const filtered = filterByThreshold(suggestions);

    assert.strictEqual(filtered.length, 1);
  });

  it('should handle missing scores as 0', () => {
    const suggestions = [
      { name: 'no-scores' }
    ];

    const filtered = filterByThreshold(suggestions);

    assert.strictEqual(filtered.length, 0);
  });

  it('should handle empty array', () => {
    const filtered = filterByThreshold([]);

    assert.strictEqual(filtered.length, 0);
  });
});

describe('applyWarningMarkers', () => {
  it('should add RISK marker for mixed high/low scores', () => {
    const suggestion1 = {
      name: 'test',
      maintainabilityScore: 80,
      securityScore: 55
    };

    const result1 = applyWarningMarkers(suggestion1);
    assert.ok(result1.markers.includes('[RISK]'));

    const suggestion2 = {
      name: 'test',
      maintainabilityScore: 55,
      securityScore: 85
    };

    const result2 = applyWarningMarkers(suggestion2);
    assert.ok(result2.markers.includes('[RISK]'));
  });

  it('should add CAUTION marker for borderline scores', () => {
    const suggestion = {
      name: 'test',
      maintainabilityScore: 55,
      securityScore: 65
    };

    const result = applyWarningMarkers(suggestion);
    assert.ok(result.markers.includes('[CAUTION]'));
  });

  it('should not add CAUTION when RISK is present', () => {
    const suggestion = {
      name: 'test',
      maintainabilityScore: 80,
      securityScore: 55
    };

    const result = applyWarningMarkers(suggestion);
    assert.ok(result.markers.includes('[RISK]'));
    assert.ok(!result.markers.includes('[CAUTION]'));
  });

  it('should not add markers for good scores', () => {
    const suggestion = {
      name: 'test',
      maintainabilityScore: 85,
      securityScore: 90
    };

    const result = applyWarningMarkers(suggestion);
    assert.strictEqual(result.markers, undefined);
  });

  it('should handle missing scores as 0', () => {
    const suggestion = {
      name: 'test'
    };

    const result = applyWarningMarkers(suggestion);
    assert.ok(result.markers === undefined || result.markers.length === 0);
  });
});
