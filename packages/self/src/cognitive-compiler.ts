import { BrainOrgan } from '@sidurijs/core';
import { SelfPackageParseResult, SelfPackageManifest, ScannedDirective } from './types';
import { scanDirective } from './safety-scanner';
import { SelfPackageParser } from './self-parser';

export interface CompilePersonaOptions {
  brain?: BrainOrgan;
  companionId?: string;
  fallbackToParser?: boolean;
}

/**
 * Cognitive Persona Compiler.
 * 
 * Translates human-authored persona documents (freeform text, Markdown lore, SillyTavern JSON,
 * or legacy .self YAML) into clean, machine-readable explicit state predicates for SQLite storage.
 * 
 * Core Architectural Principle:
 * "Humans write vibes, machines need predicates."
 * 
 * Flow:
 * 1. Untrusted persona document is passed to Brain LLM (Cognitive State Compiler).
 * 2. Brain distills identity, relational stances, and machine-readable directives with explicit predicates.
 * 3. All extracted directives are passed through `scanDirective` (Truth Gate safety scanner).
 * 4. Staged proposals are returned for human review and approval.
 * 5. If Brain is unavailable or offline, gracefully falls back to deterministic YAML/JSON parser.
 */
export async function compilePersonaDocument(
  content: string,
  options: CompilePersonaOptions = {}
): Promise<SelfPackageParseResult> {
  const { brain, companionId, fallbackToParser = false } = options;

  // 1. Try Brain Cognitive Compiler if available
  if (!brain || typeof brain.compilePersona !== 'function') {
    if (!fallbackToParser) {
      return {
        isValid: false,
        compiledBy: 'none',
        scannedDirectives: [],
        errors: ['Brain organ with compilePersona capability is required. Falling back to static parsing is prohibited to enforce Truth Gate distillation.'],
      };
    }
  }

  if (brain && typeof brain.compilePersona === 'function') {

    try {
      const compilation = await brain.compilePersona(content, { companionId });
      if (compilation && compilation.isValid && compilation.manifest) {
        const rawDirectives = compilation.manifest.directives || [];
        const scannedDirectives: ScannedDirective[] = rawDirectives.map(
          (d: any, idx: number) => {
            const id = d.id || `dir-${idx + 1}`;
            const scan = scanDirective(d.directive || '');
            return {
              id,
              directive: d.directive,
              category: d.category || 'behavioral',
              priority: d.priority || 50,
              scopeActor: d.scopeActor,
              supersedesId: d.supersedesId,
              scanResult: scan,
              approvedByDefault: scan.safe,
            };
          }
        );

        const greeting = compilation.greeting || compilation.manifest.greeting;

        const manifest: SelfPackageManifest = {
          specVersion: compilation.manifest.specVersion || '2.0.0',
          kind: 'self',
          id: compilation.manifest.id || 'custom-persona',
          name: compilation.manifest.name || compilation.manifest.identity.name,
          version: compilation.manifest.version || '1.0.0',
          author: compilation.manifest.author || { name: 'Cognitive Compiler' },
          greeting,
          identity: {
            name: compilation.manifest.identity.name,
            archetype: compilation.manifest.identity.archetype,
            origin: compilation.manifest.identity.origin,
            ethos: compilation.manifest.identity.ethos,
          },
          relationships: Array.isArray(compilation.manifest.relationships)
            ? compilation.manifest.relationships.map((rel: any) => ({
                entityId: rel.entityId || 'user',
                role: rel.role || 'user',
                stance: rel.stance || 'neutral',
                conventions: Array.isArray(rel.conventions) ? rel.conventions : [],
              }))
            : [],
          directives: scannedDirectives.map((sd) => ({
            id: sd.id,
            directive: sd.directive,
            category: sd.category,
            priority: sd.priority,
            scopeActor: sd.scopeActor,
            supersedesId: sd.supersedesId,
          })),
          dialogueExamples: compilation.manifest.dialogueExamples,
        };

        return {
          isValid: true,
          compiledBy: 'brain',
          manifest,
          greeting,
          scannedDirectives,
          errors: compilation.errors || [],
        };
      }
    } catch (err: any) {
      if (!fallbackToParser) {
        return {
          isValid: false,
          compiledBy: 'none',
          scannedDirectives: [],
          errors: [`Cognitive compiler failed: ${err.message}`],
        };
      }
    }
  }

  // 2. Fallback to deterministic parser (strictly gated by fallbackToParser)
  if (!fallbackToParser) {
    return {
      isValid: false,
      compiledBy: 'none',
      scannedDirectives: [],
      errors: ['Brain organ compilation failed or produced an invalid manifest. Static parser fallback is prohibited to preserve Truth Gate integrity.'],
    };
  }

  try {
    const parsed = SelfPackageParser.parse(content);
    return {
      ...parsed,
      compiledBy: parsed.isValid ? 'parser' : 'none',
    };
  } catch (parseErr: any) {
    return {
      isValid: false,
      compiledBy: 'none',
      scannedDirectives: [],
      errors: [parseErr.message || 'Failed to parse persona document'],
    };
  }
}
