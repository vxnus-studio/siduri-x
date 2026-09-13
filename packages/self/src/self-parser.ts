import {
  SelfPackageManifest,
  SelfPackageParseResult,
  ScannedDirective,
  PersonalityTraits,
} from './types';
import { scanDirective } from './safety-scanner';

/**
 * Lightweight YAML to JS object parser supporting basic nested maps, lists, and primitives
 * suitable for .self manifest schemas. Falls back to JSON.parse if the text starts with '{'.
 */
export function parseYamlOrJson(content: string): any {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }

  const lines = content.split('\n');
  const root: any = {};
  const stack: Array<{ indent: number; obj: any; key?: string; isList?: boolean }> = [
    { indent: -1, obj: root },
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Remove comments
    const commentIdx = rawLine.indexOf('#');
    const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).replace(/\r$/, '');
    if (!line.trim()) continue;

    const indent = line.search(/\S/);
    const text = line.trim();

    // Pop stack to match current indentation
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1];

    // Check if line is a list item: "- something"
    if (text.startsWith('- ')) {
      const listContent = text.slice(2).trim();

      // Ensure parent has an array for current key or parent itself is list
      let targetArray: any[];
      if (Array.isArray(currentParent.obj)) {
        targetArray = currentParent.obj;
      } else if (currentParent.key) {
        const parentFrame = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parentFrame && parentFrame.obj[currentParent.key] === currentParent.obj && Object.keys(currentParent.obj).length === 0) {
          targetArray = [];
          parentFrame.obj[currentParent.key] = targetArray;
          currentParent.obj = targetArray;
        } else if (Array.isArray(currentParent.obj[currentParent.key])) {
          targetArray = currentParent.obj[currentParent.key];
        } else {
          targetArray = [];
          currentParent.obj[currentParent.key] = targetArray;
        }
      } else {
        targetArray = [];
      }

      // Check if list item has inline key-value (e.g. "- id: 'dir-01'")
      const colonIdx = listContent.indexOf(':');
      if (colonIdx > 0 && !listContent.startsWith('"') && !listContent.startsWith("'")) {
        const itemKey = listContent.slice(0, colonIdx).trim();
        const itemVal = parsePrimitive(listContent.slice(colonIdx + 1).trim());
        const itemObj: any = {};
        if (itemVal !== undefined && itemVal !== '') {
          itemObj[itemKey] = itemVal;
        } else {
          itemObj[itemKey] = {};
        }
        targetArray.push(itemObj);
        stack.push({ indent, obj: itemObj, isList: false });
      } else {
        // Plain list item (scalar)
        targetArray.push(parsePrimitive(listContent));
      }
      continue;
    }

    // Key-value pair: "key: value"
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0) {
      const key = text.slice(0, colonIdx).trim();
      const valStr = text.slice(colonIdx + 1).trim();

      let targetObj = currentParent.obj;
      if (Array.isArray(targetObj)) {
        targetObj = targetObj[targetObj.length - 1];
      }

      if (valStr === '' || valStr === undefined) {
        // Nested map or upcoming list
        const childObj: any = {};
        targetObj[key] = childObj;
        stack.push({ indent, obj: childObj, key, isList: false });
      } else {
        targetObj[key] = parsePrimitive(valStr);
      }
    }
  }

  return root;
}

function parsePrimitive(val: string): any {
  if (val === '') return '';
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;

  // Quoted string
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }

  // Number
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== '') {
    return num;
  }

  return val;
}

export class SelfPackageParser {
  static parse(rawContent: string): SelfPackageParseResult {
    const errors: string[] = [];
    let data: any;

    try {
      data = parseYamlOrJson(rawContent);
    } catch (err: any) {
      return {
        isValid: false,
        errors: [`Failed to parse .self file: ${err.message}`],
        scannedDirectives: [],
      };
    }

    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: ['Invalid .self file format: Root must be an object'],
        scannedDirectives: [],
      };
    }

    // 1. Spec & Kind
    if (data.specVersion !== '1.0.0' && data.specVersion !== '2.0.0') {
      errors.push(`Unsupported or missing specVersion: "${data.specVersion}" (expected "1.0.0" or "2.0.0")`);
    }
    if (data.kind !== 'self') {
      errors.push(`Invalid kind: "${data.kind}" (expected "self")`);
    }
    if (!data.id || typeof data.id !== 'string') {
      errors.push('Missing required string field: "id"');
    }
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Missing required string field: "name"');
    }
    if (!data.version || typeof data.version !== 'string') {
      errors.push('Missing required string field: "version"');
    }

    // 2. Author
    if (!data.author || typeof data.author !== 'object' || !data.author.name) {
      errors.push('Missing required field: "author" with "name"');
    }

    // 3. Identity
    if (!data.identity || typeof data.identity !== 'object' || !data.identity.name) {
      errors.push('Missing required field: "identity" with "name"');
    }

    // 4. Personality validation (Optional in v2.0 / LLM-native mode)
    const p = data.personality;
    let traits: PersonalityTraits | undefined;

    if (p !== undefined && p !== null) {
      if (typeof p !== 'object') {
        errors.push('Field "personality" must be an object if provided');
      } else {
        traits = {};
        const keys: Array<keyof PersonalityTraits> = ['warmth', 'formality', 'sarcasm', 'verbosity', 'curiosity'];
        for (const k of keys) {
          if (p[k] !== undefined) {
            if (typeof p[k] !== 'number' || p[k] < 0.0 || p[k] > 1.0) {
              errors.push(`Personality trait "${k}" must be a number between 0.0 and 1.0`);
            } else {
              traits[k] = p[k];
            }
          }
        }
      }
    }

    // 5. Relationships validation (Optional)
    const relationships = Array.isArray(data.relationships)
      ? data.relationships
          .filter((r: any) => r && typeof r === 'object' && r.entityId)
          .map((r: any) => ({
            entityId: String(r.entityId),
            role: String(r.role || 'user'),
            stance: String(r.stance || 'neutral'),
            conventions: Array.isArray(r.conventions) ? r.conventions.map(String) : undefined,
          }))
      : undefined;

    // 6. Dialogue Examples validation (Optional)
    const dialogueExamples = Array.isArray(data.dialogueExamples)
      ? data.dialogueExamples
          .filter((ex: any) => ex && typeof ex === 'object' && ex.user && ex.assistant)
          .map((ex: any) => ({
            user: String(ex.user),
            assistant: String(ex.assistant),
          }))
      : undefined;

    // 7. Directives validation & scanning
    const scannedDirectives: ScannedDirective[] = [];
    if (!Array.isArray(data.directives)) {
      errors.push('Missing required array field: "directives"');
    } else {
      for (let i = 0; i < data.directives.length; i++) {
        const d = data.directives[i];
        if (!d || typeof d !== 'object' || !d.directive) {
          errors.push(`Directive at index ${i} is missing "directive" string`);
          continue;
        }

        const scan = scanDirective(d.directive);
        scannedDirectives.push({
          id: d.id || `dir-${i + 1}`,
          priority: typeof d.priority === 'number' ? d.priority : 50,
          directive: d.directive,
          category: d.category || 'behavioral',
          scopeActor: d.scopeActor,
          supersedesId: d.supersedesId,
          scanResult: scan,
          approvedByDefault: scan.safe,
        });
      }
    }

    const isValid = errors.length === 0;

    let manifest: SelfPackageManifest | undefined;
    if (isValid) {
      manifest = {
        specVersion: data.specVersion,
        kind: 'self',
        id: data.id,
        name: data.name,
        version: data.version,
        author: {
          name: data.author.name,
          url: data.author.url,
          signature: data.author.signature,
        },
        license: data.license,
        identity: {
          name: data.identity.name,
          archetype: data.identity.archetype,
          origin: data.identity.origin,
          ethos: data.identity.ethos,
        },
        personality: traits,
        relationships,
        directives: scannedDirectives.map((sd) => ({
          id: sd.id,
          priority: sd.priority,
          directive: sd.directive,
          category: sd.category,
          scopeActor: sd.scopeActor,
          supersedesId: sd.supersedesId,
        })),
        guardrails: Array.isArray(data.guardrails) ? data.guardrails : undefined,
        dialogueExamples,
      };
    }

    return {
      manifest,
      scannedDirectives,
      isValid,
      errors,
    };
  }
}
