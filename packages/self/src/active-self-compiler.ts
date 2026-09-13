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
    const actorId: string | undefined = rawContext.interlocutorEntityId || rawContext.actorId;
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

    // 3. Sort: Scope specificity first, then Category Tier (guardrail > relational > behavioral), then priority / recency
    winningDirectives.sort((a, b) => {
      // Actor scope specificity match
      const aMatchesActor = actorId && a.scopeActor === actorId ? 1 : 0;
      const bMatchesActor = actorId && b.scopeActor === actorId ? 1 : 0;
      if (aMatchesActor !== bMatchesActor) return bMatchesActor - aMatchesActor;

      // Category tier precedence
      const tierOrder: Record<string, number> = { guardrail: 1, relational: 2, behavioral: 3 };
      const tierA = tierOrder[a.category] || 3;
      const tierB = tierOrder[b.category] || 3;
      if (tierA !== tierB) return tierA - tierB;

      // Priority descending if provided
      return (b.priority ?? 50) - (a.priority ?? 50);
    });

    // 4. Build Identity Block
    const identityFacts: string[] = [];
    let identityBlock: string | undefined;
    if (identity) {
      const parts = [`Name: ${identity.name}`];
      if (identity.archetype) {
        parts.push(`Archetype: ${identity.archetype}`);
      }
      if (identity.ethos) {
        parts.push(`Ethos: ${identity.ethos}`);
      }
      identityBlock = parts.join(' | ');
      identityFacts.push(identityBlock);
    }

    // 5. Build Personality Block (Legacy fallback if explicitly passed with values)
    let personalityBlock: string | undefined;
    if (personality && (personality.warmth !== undefined || personality.sarcasm !== undefined)) {
      personalityBlock = [
        `Warmth: ${(personality.warmth ?? 0.5).toFixed(2)}`,
        `Formality: ${(personality.formality ?? 0.5).toFixed(2)}`,
        `Sarcasm: ${(personality.sarcasm ?? 0.5).toFixed(2)}`,
        `Verbosity: ${(personality.verbosity ?? 0.5).toFixed(2)}`,
        `Curiosity: ${(personality.curiosity ?? 0.5).toFixed(2)}`,
      ].join(' | ');
    }

    // 6. Build Relationship Block
    const relationshipFacts: string[] = [];
    let relationshipBlock: string | undefined;
    const relationalDirectives = winningDirectives.filter((d) => d.category === 'relational');

    if (relationship) {
      const lines: string[] = [];
      const target = relationship.entityId || 'interlocutor';
      const roleStr = relationship.role ? ` (${relationship.role})` : (relationship.entityType ? ` (${relationship.entityType})` : '');
      
      if (relationship.stance && relationship.stance !== 'neutral') {
        lines.push(`Toward ${target}${roleStr}: Stance=${relationship.stance}`);
      } else if (relationship.trustScore !== undefined && relationship.familiarity !== undefined) {
        lines.push(`Toward ${target}${roleStr}: Trust=${relationship.trustScore.toFixed(2)}, Familiarity=${relationship.familiarity.toFixed(2)}`);
      } else {
        lines.push(`Toward ${target}${roleStr}`);
      }

      for (const rd of relationalDirectives) {
        lines.push(`- ${rd.directive}`);
      }

      if (relationship.interactionConventions && relationship.interactionConventions.length > 0) {
        lines.push(`Conventions: ${relationship.interactionConventions.join(', ')}`);
      }
      relationshipBlock = lines.join('\n');
      relationshipFacts.push(relationshipBlock);
    } else if (relationalDirectives.length > 0) {
      relationshipBlock = relationalDirectives.map((d) => `- ${d.directive}`).join('\n');
      relationshipFacts.push(relationshipBlock);
    }

    // 7. Build Guardrails Block
    const guardrailDirectives = winningDirectives.filter((d) => d.category === 'guardrail');
    const allGuardrails = [
      ...guardrails,
      ...guardrailDirectives.map((d) => d.directive),
    ];
    let guardrailsBlock: string | undefined;
    if (allGuardrails.length > 0) {
      guardrailsBlock = allGuardrails.map((g) => `- ${g}`).join('\n');
    }

    // 8. Build Behavioral Directives Block (Non-guardrail, non-relational)
    const behavioralDirectives = winningDirectives.filter((d) => d.category !== 'guardrail' && d.category !== 'relational');
    const behavioralRules: string[] = winningDirectives.map((d) => d.directive);
    let behavioralBlock: string | undefined;
    if (behavioralDirectives.length > 0) {
      behavioralBlock = behavioralDirectives.map((d) => `- ${d.directive}`).join('\n');
    }

    // 9. Build Voice Exemplars Block
    const exemplars = rawContext.dialogueExamples;
    let exemplarsBlock: string | undefined;
    if (Array.isArray(exemplars) && exemplars.length > 0) {
      exemplarsBlock = exemplars
        .map((ex: any) => `User: "${ex.user}"\nAssistant: "${ex.assistant}"`)
        .join('\n\n');
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
      behavioralBlock,
      exemplarsBlock,
      render(): string {
        const sections: string[] = ['<active_self>'];

        if (identityBlock) {
          sections.push(`Identity:\n- ${identityBlock}`);
        }

        if (personalityBlock) {
          sections.push(`Personality Spectrum:\n- ${personalityBlock}`);
        }

        if (guardrailsBlock) {
          sections.push(`Guardrails:\n${guardrailsBlock}`);
        }

        if (relationshipBlock) {
          sections.push(`Relationship Stance:\n${relationshipBlock}`);
        }

        if (behavioralBlock) {
          sections.push(`Behavioral Directives:\n${behavioralBlock}`);
        } else if (winningDirectives.length > 0 && !guardrailsBlock && !relationshipBlock) {
          const dirLines = winningDirectives.map((d) => `- ${d.directive}`);
          sections.push(`Behavioral Directives:\n${dirLines.join('\n')}`);
        }

        if (exemplarsBlock) {
          sections.push(`Voice Exemplars:\n${exemplarsBlock}`);
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
