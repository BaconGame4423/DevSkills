import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseYAML,
  toYAML,
  validateSuggestion,
  validateExplorationSession,
  validateSuggestionDecision,
  createExplorationSession,
  transitionSessionStatus,
  recordDecision,
  generateUUID
} from '../lib/suggestion-parser.mjs';

describe('parseYAML', () => {
  it('should parse valid YAML string to object', () => {
    const yaml = `name: test\nvalue: 42\nactive: true`;
    const result = parseYAML(yaml);

    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.value, 42);
    assert.strictEqual(result.active, true);
  });

  it('should handle arrays', () => {
    const yaml = `items:\n  - first\n  - second\n  - third`;
    const result = parseYAML(yaml);

    assert.ok(Array.isArray(result.items));
    assert.strictEqual(result.items.length, 3);
    assert.strictEqual(result.items[0], 'first');
  });

  it('should handle null values', () => {
    const yaml = `name: test\nvalue: null\nother: ~`;
    const result = parseYAML(yaml);

    assert.strictEqual(result.value, null);
    assert.strictEqual(result.other, null);
  });

  it('should skip comments and empty lines', () => {
    const yaml = `# Comment\nname: test\n\nvalue: 42`;
    const result = parseYAML(yaml);

    assert.strictEqual(result.name, 'test');
    assert.strictEqual(result.value, 42);
  });
});

describe('toYAML', () => {
  it('should convert object to YAML string', () => {
    const obj = { name: 'test', value: 42, active: true };
    const yaml = toYAML(obj);

    assert.ok(yaml.includes('name: test'));
    assert.ok(yaml.includes('value: 42'));
    assert.ok(yaml.includes('active: true'));
  });

  it('should handle arrays', () => {
    const obj = { items: ['first', 'second', 'third'] };
    const yaml = toYAML(obj);

    assert.ok(yaml.includes('items:'));
    assert.ok(yaml.includes('- first'));
    assert.ok(yaml.includes('- second'));
  });

  it('should handle null values', () => {
    const obj = { name: 'test', value: null };
    const yaml = toYAML(obj);

    assert.ok(yaml.includes('value: null'));
  });

  it('should handle nested objects', () => {
    const obj = { outer: { inner: 'value' } };
    const yaml = toYAML(obj);

    assert.ok(yaml.includes('outer:'));
    assert.ok(yaml.includes('inner: value'));
  });
});

describe('validateSuggestion', () => {
  it('should pass validation for valid suggestion', () => {
    const suggestion = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'library',
      name: 'express',
      description: 'Fast web framework',
      rationale: 'Widely used',
      maintainability_score: 85,
      security_score: 90,
      source_urls: ['https://example.com'],
      adoption_examples: ['project-a'],
      evidence: ['widely adopted'],
      created_at: new Date().toISOString()
    };

    const result = validateSuggestion(suggestion);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should fail validation for invalid UUID', () => {
    const suggestion = {
      id: 'invalid-uuid',
      type: 'library',
      name: 'express',
      description: 'Fast web framework',
      rationale: 'Widely used',
      maintainability_score: 85,
      security_score: 90,
      source_urls: [],
      adoption_examples: [],
      evidence: [],
      created_at: new Date().toISOString()
    };

    const result = validateSuggestion(suggestion);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('UUID')));
  });

  it('should fail validation for invalid type', () => {
    const suggestion = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'invalid_type',
      name: 'express',
      description: 'Fast web framework',
      rationale: 'Widely used',
      maintainability_score: 85,
      security_score: 90,
      source_urls: [],
      adoption_examples: [],
      evidence: [],
      created_at: new Date().toISOString()
    };

    const result = validateSuggestion(suggestion);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('type')));
  });

  it('should fail validation for out of range scores', () => {
    const suggestion = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'library',
      name: 'express',
      description: 'Fast web framework',
      rationale: 'Widely used',
      maintainability_score: 150,
      security_score: -10,
      source_urls: [],
      adoption_examples: [],
      evidence: [],
      created_at: new Date().toISOString()
    };

    const result = validateSuggestion(suggestion);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('maintainability_score')));
    assert.ok(result.errors.some(e => e.includes('security_score')));
  });
});

describe('validateExplorationSession', () => {
  it('should pass validation for valid exploration session', () => {
    const session = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      feature_id: '008-test-feature',
      status: 'pending',
      started_at: new Date().toISOString(),
      completed_at: null,
      findings_summary: 'Test summary',
      suggestions_generated_count: 5,
      sources_consulted: ['https://example.com'],
      failure_reason: null
    };

    const result = validateExplorationSession(session);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should fail validation for invalid status', () => {
    const session = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      feature_id: '008-test-feature',
      status: 'invalid_status',
      started_at: new Date().toISOString(),
      completed_at: null,
      findings_summary: 'Test summary',
      suggestions_generated_count: 5,
      sources_consulted: [],
      failure_reason: null
    };

    const result = validateExplorationSession(session);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('status')));
  });

  it('should fail validation for missing required fields', () => {
    const session = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'pending'
    };

    const result = validateExplorationSession(session);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('validateSuggestionDecision', () => {
  it('should pass validation for valid decision', () => {
    const decision = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      suggestion_id: '550e8400-e29b-41d4-a716-446655440001',
      feature_id: '008-test-feature',
      decision: 'accepted',
      reason: 'Good fit for project',
      decided_at: new Date().toISOString()
    };

    const result = validateSuggestionDecision(decision);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should fail validation for invalid decision value', () => {
    const decision = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      suggestion_id: '550e8400-e29b-41d4-a716-446655440001',
      feature_id: '008-test-feature',
      decision: 'maybe',
      reason: '',
      decided_at: null
    };

    const result = validateSuggestionDecision(decision);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('decision')));
  });
});

describe('createExplorationSession', () => {
  it('should create exploration session with UUID and pending status', () => {
    const session = createExplorationSession('008-test-feature');

    assert.ok(session.id);
    assert.ok(session.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
    assert.strictEqual(session.feature_id, '008-test-feature');
    assert.strictEqual(session.status, 'pending');
    assert.ok(session.started_at);
    assert.strictEqual(session.completed_at, null);
    assert.strictEqual(session.suggestions_generated_count, 0);
    assert.ok(Array.isArray(session.sources_consulted));
  });
});

describe('transitionSessionStatus', () => {
  it('should allow valid transition from pending to in_progress', () => {
    const session = createExplorationSession('008-test-feature');
    const updated = transitionSessionStatus(session, 'in_progress');

    assert.strictEqual(updated.status, 'in_progress');
  });

  it('should allow valid transition from in_progress to completed', () => {
    const session = createExplorationSession('008-test-feature');
    session.status = 'in_progress';

    const updated = transitionSessionStatus(session, 'completed');

    assert.strictEqual(updated.status, 'completed');
    assert.ok(updated.completed_at);
  });

  it('should reject invalid transition', () => {
    const session = createExplorationSession('008-test-feature');

    assert.throws(() => {
      transitionSessionStatus(session, 'completed');
    }, /Invalid status transition/);
  });

  it('should reject transition from completed', () => {
    const session = createExplorationSession('008-test-feature');
    session.status = 'completed';
    session.completed_at = new Date().toISOString();

    assert.throws(() => {
      transitionSessionStatus(session, 'in_progress');
    }, /Invalid status transition/);
  });
});

describe('recordDecision', () => {
  it('should create decision with proper fields', () => {
    const suggestionId = '550e8400-e29b-41d4-a716-446655440000';
    const featureId = '008-test-feature';
    const decision = recordDecision(suggestionId, featureId, 'accepted', 'Good fit');

    assert.ok(decision.id);
    assert.strictEqual(decision.suggestion_id, suggestionId);
    assert.strictEqual(decision.feature_id, featureId);
    assert.strictEqual(decision.decision, 'accepted');
    assert.strictEqual(decision.reason, 'Good fit');
    assert.ok(decision.decided_at);
  });

  it('should set decided_at to null for pending decision', () => {
    const decision = recordDecision('550e8400-e29b-41d4-a716-446655440000', '008-test', 'pending', '');

    assert.strictEqual(decision.decided_at, null);
  });
});

describe('generateUUID', () => {
  it('should return valid UUID v4 format', () => {
    const uuid = generateUUID();

    assert.ok(uuid);
    assert.ok(uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));
  });

  it('should generate different UUIDs on each call', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();

    assert.notStrictEqual(uuid1, uuid2);
  });
});
