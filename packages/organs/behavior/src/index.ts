import { BehaviorOrgan, BehaviorContext, BehaviorDirective } from '@siduri-y/core';

const UNSAFE_INSTRUCTION_PATTERN = /\b(ignore|override|bypass)\b.{0,40}\b(system|policy|rules?|approval|permissions?)\b|\b(reveal|expose)\b.{0,40}\b(secret|token|prompt|private memory)\b/i;

export class ActiveSelfCompiler implements BehaviorOrgan {
  
  async compile(context: BehaviorContext): Promise<string> {
    const { activeRole, directives } = context;

    // 1. Find superseded IDs
    const supersededIds = new Set<string>();
    for (const d of directives) {
      if (d.status === 'ACTIVE' && d.supersedesId) {
        supersededIds.add(d.supersedesId);
      }
    }

    const activeDirectives: BehaviorDirective[] = [];

    // 2. Filter
    for (const d of directives) {
      if (supersededIds.has(d.id)) continue;
      if (d.status !== 'ACTIVE') continue;

      if (UNSAFE_INSTRUCTION_PATTERN.test(d.directive)) {
        continue;
      }

      // Scope matching: if scopeMatcher is empty, it applies to all.
      // Otherwise, it must include the activeRole.
      if (d.scopeMatcher && d.scopeMatcher.length > 0) {
        if (!d.scopeMatcher.includes(activeRole)) {
          continue;
        }
      }

      activeDirectives.push(d);
    }

    // 3. Sort by priority (descending, so higher priority is first)
    activeDirectives.sort((a, b) => b.priority - a.priority);

    // 4. Project
    if (activeDirectives.length === 0) {
      return "";
    }

    const lines = ["<active_behavioral_memory>"];
    for (const d of activeDirectives) {
      lines.push(`- ${d.directive}`);
    }
    lines.push("</active_behavioral_memory>");

    return lines.join("\n");
  }
}
