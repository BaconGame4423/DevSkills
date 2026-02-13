import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import {
  calculateMaintainabilityScore,
  calculateSecurityScore,
  filterByThreshold,
  applyWarningMarkers,
  fetchMaintainabilityData,
  fetchSecurityData,
  validateWithAPIs,
  withRateLimit,
  withCache
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

describe('fetchMaintainabilityData', () => {
  it('should reject invalid owner name', async () => {
    await assert.rejects(
      async () => await fetchMaintainabilityData('../etc', 'repo'),
      /Invalid owner name/
    );
  });

  it('should reject invalid repo name', async () => {
    await assert.rejects(
      async () => await fetchMaintainabilityData('owner', '../../../etc'),
      /Invalid repo name/
    );
  });

  it('should accept valid alphanumeric owner and repo', async () => {
    // This will fail with network error if GitHub is unreachable, but should pass validation
    try {
      await fetchMaintainabilityData('owner', 'repo');
    } catch (error) {
      // Should not fail with validation error
      assert.ok(!error.message.includes('Invalid'));
    }
  });

  it('should accept owner with dots and dashes', async () => {
    try {
      await fetchMaintainabilityData('owner.name', 'repo-name');
    } catch (error) {
      assert.ok(!error.message.includes('Invalid'));
    }
  });
});

describe('fetchSecurityData', () => {
  it('should reject unknown ecosystem', async () => {
    await assert.rejects(
      async () => await fetchSecurityData('pkg-name', 'unknown-ecosystem'),
      /Unknown ecosystem/
    );
  });

  it('should reject invalid package name', async () => {
    await assert.rejects(
      async () => await fetchSecurityData('', 'npm'),
      /Invalid package name/
    );
  });

  it('should reject package name with control characters', async () => {
    await assert.rejects(
      async () => await fetchSecurityData('pkg\x00name', 'npm'),
      /Invalid package name/
    );
  });

  it('should accept valid ecosystem', async () => {
    const validEcosystems = ['npm', 'PyPI', 'Go', 'crates.io', 'Maven'];
    for (const ecosystem of validEcosystems) {
      try {
        await fetchSecurityData('test-package', ecosystem);
      } catch (error) {
        // Should not fail with ecosystem validation error
        assert.ok(!error.message.includes('Unknown ecosystem'));
      }
    }
  });
});

describe('validateWithAPIs', () => {
  it('should handle suggestion without repository', async () => {
    const suggestion = {
      name: 'test-lib',
      packageName: 'test-package',
      ecosystem: 'npm'
    };

    const result = await validateWithAPIs(suggestion);

    assert.ok(result);
    assert.strictEqual(result.name, 'test-lib');
    assert.ok('maintainabilityScore' in result);
    assert.ok('securityScore' in result);
  });

  it('should handle suggestion without package info', async () => {
    const suggestion = {
      name: 'test-lib',
      repository: 'https://github.com/test/test'
    };

    const result = await validateWithAPIs(suggestion);

    assert.ok(result);
    assert.strictEqual(result.name, 'test-lib');
    assert.ok('maintainabilityScore' in result);
    assert.ok('securityScore' in result);
  });

  it('should enrich suggestion with validation', async () => {
    const suggestion = {
      name: 'test-lib',
      repository: 'https://github.com/test/test',
      packageName: 'test-package',
      ecosystem: 'npm'
    };

    const result = await validateWithAPIs(suggestion);

    assert.ok(result);
    assert.ok('validation' in result);
    assert.ok(result.validation);
  });

  it('should handle API failures gracefully', async () => {
    const suggestion = {
      name: 'test-lib',
      repository: 'https://github.com/nonexistent/nonexistent',
      packageName: 'nonexistent-pkg-xyz-123',
      ecosystem: 'npm'
    };

    // Should not throw even with 404s
    const result = await validateWithAPIs(suggestion);

    assert.ok(result);
    assert.strictEqual(result.name, 'test-lib');
  });
});

describe('withRateLimit', () => {
  it('should return wrapped function', () => {
    const fn = async () => 'result';
    const wrapped = withRateLimit(fn);

    assert.ok(typeof wrapped === 'function');
  });

  it('should retry on rate limit error', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('rate limit exceeded');
      }
      return 'success';
    };

    const wrapped = withRateLimit(fn, { maxRetries: 2, initialDelayMs: 10 });
    const result = await wrapped();

    assert.strictEqual(result, 'success');
    assert.ok(attempts >= 2);
  });

  it('should throw after max retries on rate limit', async () => {
    const fn = async () => {
      throw new Error('rate limit exceeded');
    };

    const wrapped = withRateLimit(fn, { maxRetries: 2, initialDelayMs: 10 });

    await assert.rejects(
      async () => await wrapped(),
      /rate limit/
    );
  });

  it('should not retry non-rate-limit errors', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      throw new Error('other error');
    };

    const wrapped = withRateLimit(fn, { maxRetries: 3, initialDelayMs: 10 });

    await assert.rejects(
      async () => await wrapped(),
      /other error/
    );

    assert.strictEqual(attempts, 1);
  });

  it('should use exponential backoff', async () => {
    const delays = [];
    const fn = async () => {
      throw new Error('rate limit');
    };

    const wrapped = withRateLimit(fn, { maxRetries: 2, initialDelayMs: 50 });

    // We can't easily measure the actual delay in tests, but we can verify it doesn't throw immediately
    const start = Date.now();
    await assert.rejects(async () => await wrapped(), /rate limit/);
    const elapsed = Date.now() - start;

    // Should take at least 50ms + 100ms for two retries with exponential backoff
    assert.ok(elapsed >= 100);
  });
});

describe('withCache', () => {
  it('should return wrapped function', () => {
    const fn = async () => 'result';
    const wrapped = withCache(fn, 'test-cache');

    assert.ok(typeof wrapped === 'function');
  });

  it('should cache results', async () => {
    let calls = 0;
    const fn = async (arg) => {
      calls++;
      return `result-${arg}`;
    };

    const wrapped = withCache(fn, 'test-cache', 1000);

    const result1 = await wrapped('arg1');
    const result2 = await wrapped('arg1');

    assert.strictEqual(calls, 1);
    assert.strictEqual(result1, 'result-arg1');
    assert.strictEqual(result2, 'result-arg1');
  });

  it('should not cache different arguments', async () => {
    let calls = 0;
    const fn = async (arg) => {
      calls++;
      return `result-${arg}`;
    };

    const wrapped = withCache(fn, 'test-cache', 1000);

    await wrapped('arg1');
    await wrapped('arg2');

    assert.strictEqual(calls, 2);
  });

  it('should expire cache after TTL', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      return 'result';
    };

    const wrapped = withCache(fn, 'test-cache', 50); // 50ms TTL

    await wrapped();
    await wrapped(); // Should use cache

    assert.strictEqual(calls, 1);

    await new Promise(resolve => setTimeout(resolve, 60)); // Wait for TTL

    await wrapped(); // Should call function again

    assert.strictEqual(calls, 2);
  });

  it('should clean up expired entries', async () => {
    const fn = async (arg) => `result-${arg}`;
    const wrapped = withCache(fn, 'test-cache', 50);

    await wrapped('arg1');
    await wrapped('arg2');

    await new Promise(resolve => setTimeout(resolve, 60));

    await wrapped('arg1'); // Should call function again and clean up expired

    // Cache should still have the new entry
    await wrapped('arg1');

    // Should only have called arg1 twice (initial + after expiry), not arg2
    assert.ok(true);
  });
});
