// eslint-disable-next-line @typescript-eslint/no-var-requires
const crypto = require('crypto');

import {
  AuthorizationCapability,
  verifyCapabilitySignature,
  canonicalizeJson,
  computeParametersHash,
  InMemoryActionStore,
} from './capability';
import { ActionPolicyEngine } from './action-policy';
import { RequestContext } from './context';

describe('AuthorizationCapability Cryptographic & Tamper Review', () => {
  const secretKey = 'prod_secret_signing_key';
  let engine: ActionPolicyEngine;
  let sampleContext: RequestContext;

  beforeEach(() => {
    engine = new ActionPolicyEngine({
      secretKey,
      defaultRiskLevel: 'LOW',
    });

    sampleContext = {
      companionId: 'comp-alpha',
      actor: {
        actorId: 'user-77',
        sessionId: 'sess-88',
        authorizationRole: 'operator',
        capabilities: ['tool:send_email'],
        authenticated: true,
      },
      conversation: {
        channel: 'direct',
        audienceId: 'aud-alpha',
        correlationId: 'corr-999',
      },
    };

    engine.registerToolDefinition({
      name: 'send_email',
      providerId: 'comm',
      description: 'Send email',
      inputSchema: {},
      riskLevel: 'LOW',
      requiredCapabilities: ['tool:send_email'],
    });
  });

  describe('Field-Level Tampering Invalidation (HMAC-SHA-256)', () => {
    let legitCapability: AuthorizationCapability;

    beforeEach(async () => {
      const { capability } = await engine.evaluateAction({
        actionId: 'act-email-1',
        toolName: 'comm/send_email',
        parameters: { to: 'alice@example.com', subject: 'Hello' },
        context: sampleContext,
      });
      expect(capability).toBeDefined();
      legitCapability = capability!;
    });

    it('verifies untouched authentic capability', () => {
      expect(verifyCapabilitySignature(legitCapability, secretKey)).toBe(true);
    });

    it('invalidates signature if executionId is modified', () => {
      const tampered = { ...legitCapability, executionId: 'exec-tampered-999' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if actionId is modified', () => {
      const tampered = { ...legitCapability, actionId: 'act-tampered-999' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if toolName is modified', () => {
      const tampered = { ...legitCapability, toolName: 'admin/delete_all' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if providerId is modified', () => {
      const tampered = { ...legitCapability, providerId: 'untrusted_plugin' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if parametersHash is modified', () => {
      const tampered = { ...legitCapability, parametersHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if actorId is modified', () => {
      const tampered = { ...legitCapability, actorId: 'attacker-root' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if sessionId is modified', () => {
      const tampered = { ...legitCapability, sessionId: 'hijacked-session' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if channel is modified', () => {
      const tampered = { ...legitCapability, channel: 'public' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if correlationId is modified', () => {
      const tampered = { ...legitCapability, correlationId: 'corr-spoofed' };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if expiresAt is modified to extend lifetime', () => {
      const tampered = { ...legitCapability, expiresAt: new Date(Date.now() + 86400000).toISOString() };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('invalidates signature if issuedAt is modified', () => {
      const tampered = { ...legitCapability, issuedAt: new Date(Date.now() - 100000).toISOString() };
      expect(verifyCapabilitySignature(tampered, secretKey)).toBe(false);
    });

    it('rejects verification if secretKey is mismatched', () => {
      expect(verifyCapabilitySignature(legitCapability, 'wrong_secret_key')).toBe(false);
    });

    it('handles malformed, truncated, or non-hex signatures safely without crashing', () => {
      const malformed1 = { ...legitCapability, signature: 'not_a_hex_string' };
      expect(verifyCapabilitySignature(malformed1, secretKey)).toBe(false);

      const malformed2 = { ...legitCapability, signature: 'deadbeef' };
      expect(verifyCapabilitySignature(malformed2, secretKey)).toBe(false);

      const malformed3 = { ...legitCapability, signature: '' };
      expect(verifyCapabilitySignature(malformed3, secretKey)).toBe(false);
    });
  });

  describe('Deterministic Canonicalization', () => {
    it('produces identical canonical JSON strings regardless of key insertion order', () => {
      const objA = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const objB = { a: 1, c: { y: 25, z: 26 }, b: 2 };

      expect(canonicalizeJson(objA)).toBe(canonicalizeJson(objB));
      expect(computeParametersHash(objA)).toBe(computeParametersHash(objB));
    });
  });

  describe('Audit Trail SHA-256 Hash Chaining and Mutation Detection', () => {
    it('detects tampering or mutation in previous audit events in the chain', async () => {
      const store = new InMemoryActionStore();
      const policyEngine = new ActionPolicyEngine({ store, secretKey });

      policyEngine.registerToolDefinition({
        name: 'send_email',
        providerId: 'comm',
        description: 'Send email',
        inputSchema: {},
        riskLevel: 'LOW',
      });

      // Event 1
      await policyEngine.evaluateAction({
        actionId: 'act-1',
        toolName: 'comm/send_email',
        parameters: { step: 1 },
        context: sampleContext,
      });

      // Event 2
      await policyEngine.evaluateAction({
        actionId: 'act-2',
        toolName: 'comm/send_email',
        parameters: { step: 2 },
        context: sampleContext,
      });

      const auditTrail = await store.getAuditLog();
      expect(auditTrail.length).toBe(2);

      const event1 = auditTrail[0];
      const event2 = auditTrail[1];

      // Recompute expected hash chain using standard SHA-256
      const initialPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
      const canonical1 = canonicalizeJson({
        executionId: event1.executionId,
        actionId: event1.actionId,
        toolName: event1.toolName,
        lifecycle: event1.lifecycle,
        parametersHash: event1.parametersHash,
        timestamp: event1.timestamp,
      });
      const expectedHash1 = crypto.createHash('sha256').update(`${initialPrevHash}:${canonical1}`, 'utf8').digest('hex');
      expect(event1.resultHash).toBe(expectedHash1);

      const canonical2 = canonicalizeJson({
        executionId: event2.executionId,
        actionId: event2.actionId,
        toolName: event2.toolName,
        lifecycle: event2.lifecycle,
        parametersHash: event2.parametersHash,
        timestamp: event2.timestamp,
      });
      const expectedHash2 = crypto.createHash('sha256').update(`${expectedHash1}:${canonical2}`, 'utf8').digest('hex');
      expect(event2.resultHash).toBe(expectedHash2);

      // If an attacker altered event 1 retrospectively, the hash chain breaks for event 2
      const tamperedCanonical1 = canonicalizeJson({
        ...JSON.parse(canonical1),
        actionId: 'act-tampered-1',
      });
      const tamperedHash1 = crypto.createHash('sha256').update(`${initialPrevHash}:${tamperedCanonical1}`, 'utf8').digest('hex');
      const brokenHash2 = crypto.createHash('sha256').update(`${tamperedHash1}:${canonical2}`, 'utf8').digest('hex');

      expect(brokenHash2).not.toBe(event2.resultHash);
    });
  });
});
