import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createBackup,
  listBackups,
  recoverFromBackup,
  cleanupBackups,
  detectCorruption,
  recoverStateInconsistency,
  writeWithBackup,
  archiveBackups,
  validateBeforeWrite,
  recoverSuggestionDecisions
} from '../lib/backup-manager.mjs';

describe('createBackup', () => {
  it('should create backup file in .backups directory', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'name: test\nvalue: 42\n', 'utf8');

      const backupPath = await createBackup(testFile);

      assert.ok(backupPath);
      assert.ok(backupPath.includes('.backups'));
      assert.ok(backupPath.endsWith('.yaml'));

      const backupContent = await readFile(backupPath, 'utf8');
      assert.strictEqual(backupContent, 'name: test\nvalue: 42\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should return null if source file does not exist', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const nonExistentFile = join(tempDir, 'nonexistent.yaml');

    try {
      const backupPath = await createBackup(nonExistentFile);
      assert.strictEqual(backupPath, null);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create timestamped backup filenames', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content: test\n', 'utf8');

      const backup1 = await createBackup(testFile);
      await new Promise(resolve => setTimeout(resolve, 100));
      const backup2 = await createBackup(testFile);

      assert.notStrictEqual(backup1, backup2);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('listBackups', () => {
  it('should return sorted list of backups', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content: test\n', 'utf8');

      await createBackup(testFile);
      await new Promise(resolve => setTimeout(resolve, 100));
      await createBackup(testFile);
      await new Promise(resolve => setTimeout(resolve, 100));
      await createBackup(testFile);

      const backups = await listBackups(testFile);

      assert.ok(backups.length >= 3);
      assert.ok(backups[0].timestamp >= backups[1].timestamp);
      assert.ok(backups[0].path);
      assert.ok(backups[0].size > 0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should return empty array if no backups exist', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      const backups = await listBackups(testFile);
      assert.strictEqual(backups.length, 0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should limit to 5 most recent backups', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content: test\n', 'utf8');

      for (let i = 0; i < 7; i++) {
        await createBackup(testFile);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const backups = await listBackups(testFile);
      assert.ok(backups.length <= 5);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('recoverFromBackup', () => {
  it('should restore file from latest backup', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'original: content\n', 'utf8');
      await createBackup(testFile);

      await writeFile(testFile, 'modified: content\n', 'utf8');

      const result = await recoverFromBackup(testFile);

      assert.strictEqual(result.success, true);
      assert.ok(result.restoredFrom);

      const content = await readFile(testFile, 'utf8');
      assert.strictEqual(content, 'original: content\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should return failure if no backups found', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      const result = await recoverFromBackup(testFile);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('No backups found'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should restore from specific backup if provided', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'version: 1\n', 'utf8');
      const backup1 = await createBackup(testFile);

      await new Promise(resolve => setTimeout(resolve, 10));
      await writeFile(testFile, 'version: 2\n', 'utf8');
      await createBackup(testFile);

      await writeFile(testFile, 'version: 3\n', 'utf8');

      const result = await recoverFromBackup(testFile, backup1);

      assert.strictEqual(result.success, true);
      const content = await readFile(testFile, 'utf8');
      assert.strictEqual(content, 'version: 1\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('cleanupBackups', () => {
  it('should remove old backups beyond maxCount', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content: test\n', 'utf8');

      for (let i = 0; i < 8; i++) {
        await createBackup(testFile);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const result = await cleanupBackups(testFile, 30, 3);

      assert.ok(result.deleted > 0);
      assert.strictEqual(result.kept, 3);

      const backups = await listBackups(testFile);
      assert.ok(backups.length <= 3);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should return zero counts if no backups exist', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      const result = await cleanupBackups(testFile);

      assert.strictEqual(result.deleted, 0);
      assert.strictEqual(result.kept, 0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('detectCorruption', () => {
  it('should detect corrupted YAML', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'invalid: yaml: : :\n', 'utf8');

      const result = await detectCorruption(testFile, 'exploration-session');

      assert.strictEqual(result.corrupted, true);
      assert.ok(result.errors.length > 0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect missing required fields for exploration-session', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'some_field: value\n', 'utf8');

      const result = await detectCorruption(testFile, 'exploration-session');

      assert.strictEqual(result.corrupted, true);
      assert.ok(result.errors.some(e => e.includes('id')));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect empty file', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, '', 'utf8');

      const result = await detectCorruption(testFile, 'suggestions');

      assert.strictEqual(result.corrupted, true);
      assert.ok(result.errors.some(e => e.includes('empty')));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should accept valid suggestions array', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, '- id: test\n  name: example\n', 'utf8');

      const result = await detectCorruption(testFile, 'suggestions');

      assert.strictEqual(result.corrupted, false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should accept empty array as valid', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, '[]\n', 'utf8');

      const result = await detectCorruption(testFile, 'suggestions');

      assert.strictEqual(result.corrupted, false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('recoverStateInconsistency', () => {
  it('should fix mismatched suggestion count', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const sessionFile = join(tempDir, 'exploration-session.yaml');
    const suggestionsFile = join(tempDir, 'suggestions.yaml');

    try {
      await writeFile(sessionFile, 'id: test-id\nsuggestions_generated_count: 5\n', 'utf8');
      await writeFile(suggestionsFile, '- id: 1\n- id: 2\n- id: 3\n', 'utf8');

      const result = await recoverStateInconsistency(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.fixes.length > 0);
      assert.ok(result.fixes.some(f => f.includes('suggestion count')));

      const updatedSession = await readFile(sessionFile, 'utf8');
      assert.ok(updatedSession.includes('suggestions_generated_count: 3'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create missing decisions file', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const sessionFile = join(tempDir, 'exploration-session.yaml');
    const suggestionsFile = join(tempDir, 'suggestions.yaml');

    try {
      await writeFile(sessionFile, 'id: test\nstatus: completed\n', 'utf8');
      await writeFile(suggestionsFile, '- id: 1\n', 'utf8');

      const result = await recoverStateInconsistency(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.fixes.some(f => f.includes('suggestion-decisions')));

      const decisionsContent = await readFile(join(tempDir, 'suggestion-decisions.yaml'), 'utf8');
      assert.ok(decisionsContent);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should report no inconsistencies for valid state', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const sessionFile = join(tempDir, 'exploration-session.yaml');
    const suggestionsFile = join(tempDir, 'suggestions.yaml');
    const decisionsFile = join(tempDir, 'suggestion-decisions.yaml');

    try {
      await writeFile(sessionFile, 'id: test\nsuggestions_generated_count: 2\n', 'utf8');
      await writeFile(suggestionsFile, '- id: 1\n- id: 2\n', 'utf8');
      await writeFile(decisionsFile, '[]\n', 'utf8');

      const result = await recoverStateInconsistency(tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.fixes.length, 0);
      assert.ok(result.message.includes('No inconsistencies'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeWithBackup', () => {
  it('should write content with backup', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'original: content\n', 'utf8');

      const result = await writeWithBackup(testFile, 'new: content\n');

      assert.strictEqual(result.success, true);
      assert.ok(result.backupPath);

      const content = await readFile(testFile, 'utf8');
      assert.strictEqual(content, 'new: content\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create new file without backup', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'new.yaml');

    try {
      const result = await writeWithBackup(testFile, 'content\n');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.backupPath, null);

      const content = await readFile(testFile, 'utf8');
      assert.strictEqual(content, 'content\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create directory if not exists', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'subdir', 'test.yaml');

    try {
      const result = await writeWithBackup(testFile, 'content\n');

      assert.strictEqual(result.success, true);

      const content = await readFile(testFile, 'utf8');
      assert.strictEqual(content, 'content\n');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('archiveBackups', () => {
  it('should move backups to archive directory', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content\n', 'utf8');
      await createBackup(testFile);
      await new Promise(resolve => setTimeout(resolve, 10));
      await createBackup(testFile);

      const result = await archiveBackups(tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.archived, 2);
      assert.ok(result.message.includes('Archived'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should use default archive directory', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');

    try {
      await writeFile(testFile, 'content\n', 'utf8');
      await createBackup(testFile);

      await archiveBackups(tempDir);

      const archiveDir = join(tempDir, '.completed-backups');
      const archiveExists = await stat(archiveDir).then(() => true).catch(() => false);
      assert.ok(archiveExists);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should use custom archive directory if provided', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const testFile = join(tempDir, 'test.yaml');
    const customArchiveDir = join(tempDir, 'custom-archive');

    try {
      await writeFile(testFile, 'content\n', 'utf8');
      await createBackup(testFile);

      await archiveBackups(tempDir, customArchiveDir);

      const archiveExists = await stat(customArchiveDir).then(() => true).catch(() => false);
      assert.ok(archiveExists);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should handle no backups to archive', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));

    try {
      const result = await archiveBackups(tempDir);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.archived, 0);
      assert.ok(result.message.includes('No backups'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe('validateBeforeWrite', () => {
  it('should validate non-empty content', async () => {
    const result = await validateBeforeWrite('/test/path', 'name: test\nvalue: 42\n');

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should reject empty content', async () => {
    const result = await validateBeforeWrite('/test/path', '');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('empty')));
  });

  it('should reject whitespace-only content', async () => {
    const result = await validateBeforeWrite('/test/path', '   \n  \n');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('empty')));
  });

  it('should reject content without YAML structure', async () => {
    const result = await validateBeforeWrite('/test/path', 'just some text\nwithout structure');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('key:value')));
  });

  it('should reject content with tabs', async () => {
    const result = await validateBeforeWrite('/test/path', 'name:\n\tvalue: 42\n');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('tab')));
  });
});

describe('recoverSuggestionDecisions', () => {
  it('should return success if file not corrupted', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const decisionsFile = join(tempDir, 'suggestion-decisions.yaml');

    try {
      await writeFile(decisionsFile, '- suggestion_id: test-id\n  decision: pending\n', 'utf8');

      const result = await recoverSuggestionDecisions(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('not corrupted'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should recover from backup', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const decisionsFile = join(tempDir, 'suggestion-decisions.yaml');

    try {
      await writeFile(decisionsFile, '- suggestion_id: test-id\n  decision: pending\n', 'utf8');
      await createBackup(decisionsFile);
      await writeFile(decisionsFile, 'corrupted: yaml: ::\n', 'utf8');

      const result = await recoverSuggestionDecisions(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.method === 'backup');
      assert.ok(result.message.includes('backup'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should recreate from suggestions', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));
    const suggestionsFile = join(tempDir, 'suggestions.yaml');

    try {
      await writeFile(suggestionsFile, '- id: suggestion-1\n  name: test\n- id: suggestion-2\n  name: test2\n', 'utf8');

      const result = await recoverSuggestionDecisions(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.method === 'recreate_from_suggestions');
      assert.ok(result.message.includes('suggestion-1'));

      const decisionsContent = await readFile(join(tempDir, 'suggestion-decisions.yaml'), 'utf8');
      assert.ok(decisionsContent.includes('suggestion_id: suggestion-1'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create empty decisions if no suggestions', async () => {
    const tempDir = await mkdtemp(join(process.cwd(), '.tmp-test-'));

    try {
      const result = await recoverSuggestionDecisions(tempDir);

      assert.strictEqual(result.success, true);
      assert.ok(result.method === 'create_empty' || result.method === 'no_recovery_needed');

      const decisionsContent = await readFile(join(tempDir, 'suggestion-decisions.yaml'), 'utf8');
      assert.ok(decisionsContent.includes('[]'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
