import { BehaviorOrgan, BehaviorContext, BehaviorDirective, ActiveSelfProjection } from '@siduri-x/core';

const UNSAFE_INSTRUCTION_PATTERN = /\b(ignore|override|bypass)\b.{0,40}\b(system|policy|rules?|approval|permissions?)\b|\b(reveal|expose)\b.{0,40}\b(secret|token|prompt|private memory)\b/i;

export class ActiveSelfCompiler implements BehaviorOrgan {
  
  async compileProjection(context: BehaviorContext): Promise<ActiveSelfProjection> {
    const { activeRole, directives, companionId, channel, audienceId, now: nowIso } = context;
    const now = nowIso ? new Date(nowIso) : new Date();

    // 1. Identify superseded directives
    const supersededIds = new Set<string>();
    for (const d of directives) {
      if (d.status === 'ACTIVE' && d.supersedesId) {
        supersededIds.add(d.supersedesId);
      }
    }

    const activeDirectives: BehaviorDirective[] = [];
    const excludedIds: string[] = [];
    const diagnostics: Record<string, string> = {};

    // 2. Admission & Scope Filtering
    for (const d of directives) {
      // Companion isolation check
      if (companionId && d.companionId && d.companionId !== companionId) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'companion_mismatch';
        continue;
      }

      // Lifecycle status checks
      if (d.id && supersededIds.has(d.id)) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'superseded_directive';
        continue;
      }

      if (d.status === 'PENDING') {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'pending_not_active';
        continue;
      }

      if (d.status !== 'ACTIVE') {
        excludedIds.push(d.id);
        diagnostics[d.id] = `state_${d.status.toLowerCase()}`;
        continue;
      }

      // Validity window check
      if (d.validFrom && new Date(d.validFrom) > now) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'valid_from_in_future';
        continue;
      }
      if (d.validUntil && new Date(d.validUntil) < now) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'expired_valid_until';
        continue;
      }

      // Unsafe instruction injection check
      if (UNSAFE_INSTRUCTION_PATTERN.test(d.directive)) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'unsafe_directive';
        continue;
      }

      // Audience & Role Scope matching
      if (d.allowedAudiences && d.allowedAudiences.length > 0) {
        if (audienceId && !d.allowedAudiences.includes(audienceId) && !d.allowedAudiences.includes('audience-public')) {
          excludedIds.push(d.id);
          diagnostics[d.id] = 'audience_mismatch';
          continue;
        }
      }

      if (d.scopeMatcher && d.scopeMatcher.length > 0) {
        if (!d.scopeMatcher.includes(activeRole)) {
          excludedIds.push(d.id);
          diagnostics[d.id] = 'role_scope_mismatch';
          continue;
        }
      }

      activeDirectives.push(d);
    }

    // 3. Conflict resolution & precedence
    // Sort criteria: priority (descending), then ID tie breaker
    activeDirectives.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

    // Deduplicate by (domain/memoryClass, subject, predicate) if provided
    const dedupedMap = new Map<string, BehaviorDirective>();
    const winningDirectives: BehaviorDirective[] = [];

    for (const d of activeDirectives) {
      if (d.subject && d.predicate) {
        const key = `${d.memoryClass || 'behavioral'}:${d.subject}:${d.predicate}`;
        if (dedupedMap.has(key)) {
          excludedIds.push(d.id);
          diagnostics[d.id] = 'directive_conflict';
          continue;
        }
        dedupedMap.set(key, d);
      }
      winningDirectives.push(d);
    }

    // 4. Project into Identity, Relationship, Behavior
    const identityFacts: string[] = [];
    const relationshipFacts: string[] = [];
    const behavioralRules: string[] = [];
    const activeIds: string[] = [];

    for (const d of winningDirectives) {
      activeIds.push(d.id);
      if (d.memoryClass === 'identity') {
        identityFacts.push(d.value ? `${d.subject} ${d.predicate} = ${d.value}` : d.directive);
      } else if (d.memoryClass === 'relationship') {
        relationshipFacts.push(d.value ? `${d.subject} ${d.predicate} = ${d.value}` : d.directive);
      } else {
        behavioralRules.push(d.directive);
      }
    }

    return {
      identityFacts,
      relationshipFacts,
      behavioralRules,
      activeIds,
      excludedIds,
      diagnostics,
      render(): string {
        if (identityFacts.length === 0 && relationshipFacts.length === 0 && behavioralRules.length === 0) {
          return '';
        }
        const lines = ['<active_behavioral_memory>'];
        if (identityFacts.length > 0) {
          lines.push('Identity:');
          for (const fact of identityFacts) lines.push(`- ${fact}`);
        }
        if (relationshipFacts.length > 0) {
          if (identityFacts.length > 0) lines.push('');
          lines.push('Relationship:');
          for (const fact of relationshipFacts) lines.push(`- ${fact}`);
        }
        if (behavioralRules.length > 0) {
          if (identityFacts.length > 0 || relationshipFacts.length > 0) lines.push('');
          lines.push('Behavior:');
          for (const rule of behavioralRules) lines.push(`- ${rule}`);
        }
        lines.push('</active_behavioral_memory>');
        return lines.join('\n');
      }
    };
  }

  async compile(context: BehaviorContext): Promise<string> {
    const projection = await this.compileProjection(context);
    return projection.render();
  }
}
