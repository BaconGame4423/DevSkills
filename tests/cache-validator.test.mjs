import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkCacheFreshness,
  tagStaleLibraries,
  incrementCacheVersion
} from '../lib/cache-validator.mjs';

describe('checkCacheFreshness', () => {
  it('should detect old cache as stale', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60); // 60 days ago

      const cacheContent = `version: 1.0.0\nlast_updated: ${oldDate.toISOString()}\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = checkCacheFreshness(cacheFile);

      assert.strictEqual(result.fresh, false);
      assert.strictEqual(result.needsValidation, true);
      assert.ok(result.age >= 60);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect recent cache as fresh', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      const cacheContent = `version: 1.0.0\nlast_updated: ${recentDate.toISOString()}\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = checkCacheFreshness(cacheFile);

      assert.strictEqual(result.fresh, true);
      assert.strictEqual(result.needsValidation, false);
      assert.ok(result.age < 30);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle missing cache file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'nonexistent.yaml');

    try {
      const result = checkCacheFreshness(cacheFile);

      assert.strictEqual(result.fresh, false);
      assert.strictEqual(result.needsValidation, true);
      assert.ok(result.error.includes('not found'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle missing last_updated field', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const cacheContent = `version: 1.0.0\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = checkCacheFreshness(cacheFile);

      assert.strictEqual(result.fresh, false);
      assert.strictEqual(result.needsValidation, true);
      assert.ok(result.error.includes('No last_updated'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should calculate age in months correctly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90); // ~3 months ago

      const cacheContent = `version: 1.0.0\nlast_updated: ${oldDate.toISOString()}\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = checkCacheFreshness(cacheFile);

      assert.ok(result.ageMonths >= 2 && result.ageMonths <= 3);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('tagStaleLibraries', () => {
  it('should add STALE prefix to stale libraries', () => {
    const libraries = [
      {
        name: 'old-lib',
        validation_status: {
          is_stale: true,
          months_since_last_commit: 18
        }
      },
      {
        name: 'fresh-lib',
        validation_status: {
          is_stale: false,
          months_since_last_commit: 3
        }
      }
    ];

    const tagged = tagStaleLibraries(libraries);

    assert.ok(tagged[0].name.includes('[STALE]'));
    assert.ok(!tagged[1].name.includes('[STALE]'));
  });

  it('should not duplicate STALE prefix', () => {
    const libraries = [
      {
        name: '[STALE] already-tagged',
        validation_status: {
          is_stale: true
        }
      }
    ];

    const tagged = tagStaleLibraries(libraries);

    const staleCount = (tagged[0].name.match(/\[STALE\]/g) || []).length;
    assert.strictEqual(staleCount, 1);
  });

  it('should handle empty array', () => {
    const tagged = tagStaleLibraries([]);
    assert.strictEqual(tagged.length, 0);
  });

  it('should handle libraries without validation_status', () => {
    const libraries = [
      {
        name: 'no-validation'
      }
    ];

    const tagged = tagStaleLibraries(libraries);

    assert.strictEqual(tagged[0].name, 'no-validation');
  });

  it('should preserve other library properties', () => {
    const libraries = [
      {
        name: 'test-lib',
        version: '1.0.0',
        maintainability_score: 85,
        validation_status: {
          is_stale: true
        }
      }
    ];

    const tagged = tagStaleLibraries(libraries);

    assert.ok(tagged[0].name.includes('[STALE]'));
    assert.strictEqual(tagged[0].version, '1.0.0');
    assert.strictEqual(tagged[0].maintainability_score, 85);
  });
});

describe('incrementCacheVersion', () => {
  it('should bump patch version', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const cacheContent = `version: 1.0.5\nlast_updated: 2024-01-01T00:00:00.000Z\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = incrementCacheVersion(cacheFile);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.old_version, '1.0.5');
      assert.strictEqual(result.new_version, '1.0.6');

      const updatedContent = await readFile(cacheFile, 'utf8');
      assert.ok(updatedContent.includes('version: 1.0.6'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle missing cache file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'nonexistent.yaml');

    try {
      const result = incrementCacheVersion(cacheFile);

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not found'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should update last_updated timestamp', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const cacheContent = `version: 1.0.0\nlast_updated: 2024-01-01T00:00:00.000Z\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = incrementCacheVersion(cacheFile);

      assert.strictEqual(result.success, true);
      assert.ok(result.last_updated);
      assert.notStrictEqual(result.last_updated, '2024-01-01T00:00:00.000Z');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle version with missing patch number', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const cacheContent = `version: 1.0\nlast_updated: 2024-01-01T00:00:00.000Z\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = incrementCacheVersion(cacheFile);

      assert.strictEqual(result.success, true);
      assert.ok(result.new_version.includes('.1'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle default version if missing', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'cache-test-'));
    const cacheFile = join(tempDir, 'cache.yaml');

    try {
      const cacheContent = `last_updated: 2024-01-01T00:00:00.000Z\ncategories:\n  test: []\n`;
      await writeFile(cacheFile, cacheContent, 'utf8');

      const result = incrementCacheVersion(cacheFile);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.old_version, '1.0.0');
      assert.strictEqual(result.new_version, '1.0.1');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
