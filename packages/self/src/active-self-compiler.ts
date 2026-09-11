import {
  SelfDirective,
  BehaviorOrgan,
  BehaviorContext,
  ActiveSelfProjection as CoreActiveSelfProjection,
} from '@siduri-x/core';
import {
  SelfCompilationContext,
  ActiveSelfProjection,
  SelfIdentity,
  PersonalityTraits,
  SelfRelationship,
} from './types';
import { scanDirective } from './safety-scanner';

export class ActiveSelfCompiler implements BehaviorOrgan {
  async compileProjection(context: SelfCompilationContext | BehaviorContext): Promise<ActiveSelfProjection & CoreActiveSelfProjection> {
    const rawContext = context as any;
    const companionId: string | undefined = rawContext.companionId;
    const identity: SelfIdentity | undefined = rawContext.identity;
    const personality: PersonalityTraits | undefined = rawContext.personality;
    const relationship: SelfRelationship | undefined = rawContext.relationship;
    const guardrails: string[] = Array.isArray(rawContext.guardrails) ? rawContext.guardrails : [];
    const directives: SelfDirective[] = Array.isArray(rawContext.directives) ? rawContext.directives : [];
    const nowIso: string | undefined = rawContext.now;

    const now = nowIso ? new Date(nowIso) : new Date();

    // 1. Identify superseded directives
    const supersededIds = new Set<string>();
    for (const d of directives) {
      if (d.status === 'ACTIVE' && d.supersedesId) {
        supersededIds.add(d.supersedesId);
      }
    }

    const winningDirectives: SelfDirective[] = [];
    const excludedIds: string[] = [];
    const diagnostics: Record<string, string> = {};

    // 2. Filter directives
    for (const d of directives) {
      // Isolation check
      if (companionId && d.companionId && d.companionId !== companionId) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'companion_mismatch';
        continue;
      }

      // Status check
      if (d.status !== 'ACTIVE') {
        excludedIds.push(d.id);
        diagnostics[d.id] = `state_${String(d.status).toLowerCase()}`;
        continue;
      }

      // Superseded check
      if (d.id && supersededIds.has(d.id)) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'superseded_directive';
        continue;
      }

      // Temporal checks if dates are present
      const anyD = d as any;
      if (anyD.validFrom && new Date(anyD.validFrom) > now) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'valid_from_in_future';
        continue;
      }
      if (anyD.validUntil && new Date(anyD.validUntil) < now) {
        excludedIds.push(d.id);
        diagnostics[d.id] = 'expired_valid_until';
        continue;
      }

      // Prompt injection safety scan
      const scan = scanDirective(d.directive);
      if (!scan.safe) {
        excludedIds.push(d.id);
        diagnostics[d.id] = scan.reason || 'unsafe_directive';
        continue;
      }

      winningDirectives.push(d);
    }

    // 3. Sort by priority descending
    winningDirectives.sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

    // 4. Build Identity Block
    const identityFacts: string[] = [];
    let identityBlock: string | undefined;
    if (identity) {
      const parts = [`Name: ${identity.name}`];
      if (identity.archetype) {
        parts.push(`Archetype: ${identity.archetype}`);
      }
      identityBlock = parts.join(' | ');
      identityFacts.push(identityBlock);
    }

    // 5. Build Personality Block
    let personalityBlock: string | undefined;
    if (personality) {
      personalityBlock = [
        `Warmth: ${personality.warmth.toFixed(2)}`,
        `Formality: ${personality.formality.toFixed(2)}`,
        `Sarcasm: ${personality.sarcasm.toFixed(2)}`,
        `Verbosity: ${personality.verbosity.toFixed(2)}`,
        `Curiosity: ${personality.curiosity.toFixed(2)}`,
      ].join(' | ');
    }

    // 6. Build Relationship Block
    const relationshipFacts: string[] = [];
    let relationshipBlock: string | undefined;
    if (relationship) {
      const lines = [
        `Toward ${relationship.entityId} (${relationship.entityType}): Trust=${relationship.trustScore.toFixed(2)}, Familiarity=${relationship.familiarity.toFixed(2)}`,
      ];
      if (relationship.interactionConventions && relationship.interactionConventions.length > 0) {
        lines.push(`Conventions: ${relationship.interactionConventions.join(', ')}`);
      }
      relationshipBlock = lines.join('\n');
      relationshipFacts.push(relationshipBlock);
    }

    // 7. Build Behavioral Rules & Guardrails
    const behavioralRules: string[] = winningDirectives.map((d) => d.directive);
    let guardrailsBlock: string | undefined;
    if (guardrails.length > 0) {
      guardrailsBlock = guardrails.map((g) => `- ${g}`).join('\n');
    }

    const activeIds: string[] = winningDirectives.map((d) => d.id);

    return {
      identityFacts,
      relationshipFacts,
      behavioralRules,
      activeIds,
      excludedIds,
      diagnostics,
      winningDirectives,
      identityBlock,
      personalityBlock,
      relationshipBlock,
      guardrailsBlock,
      render(): string {
        const sections: string[] = ['<active_self>'];

        if (identityBlock) {
          sections.push(`Identity:\n- ${identityBlock}`);
        }

        if (personalityBlock) {
          sections.push(`Personality Spectrum:\n- ${personalityBlock}`);
        }

        if (relationshipBlock) {
          sections.push(`Relationship Stance:\n${relationshipBlock}`);
        }

        if (winningDirectives.length > 0) {
          const dirLines = winningDirectives.map((d) => `- [Priority ${d.priority}] ${d.directive}`);
          sections.push(`Behavioral Directives:\n${dirLines.join('\n')}`);
        }

        if (guardrailsBlock) {
          sections.push(`Guardrails:\n${guardrailsBlock}`);
        }

        sections.push('</active_self>');
        return sections.join('\n\n');
      },
    };
  }

  async compile(context: SelfCompilationContext | BehaviorContext): Promise<string> {
    const projection = await this.compileProjection(context);
    return projection.render();
  }
}
