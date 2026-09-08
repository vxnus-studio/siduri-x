/**
 * Multi-layer safety scanner for behavioral directive injection detection.
 *
 * Layers:
 *   1. Unicode normalization & deobfuscation
 *   2. Expanded multi-category pattern bank
 *   3. Structural heuristic checks
 *
 * Returns a scan result with `safe` boolean and `reason` diagnostic string.
 */

export interface ScanResult {
  safe: boolean;
  reason?: string;
}

// ── Layer 1: Unicode normalization & deobfuscation ──────────────────────

// Zero-width and invisible Unicode characters
const INVISIBLE_CHARS = /[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u034F\u17B4\u17B5\u180E\u2061-\u2064\u206A-\u206F]/g;

// Common leet-speak substitutions
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '@': 'a', '$': 's', '!': 'i',
};

// Common Unicode confusables (Cyrillic, Greek, etc.)
const CONFUSABLE_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c',
  '\u0443': 'y', '\u0445': 'x', '\u0456': 'i', '\u0458': 'j', '\u04BB': 'h',
  '\u0261': 'g', '\u03B1': 'a', '\u03BF': 'o', '\u03B5': 'e',
  // Fullwidth Latin
  '\uFF41': 'a', '\uFF42': 'b', '\uFF43': 'c', '\uFF44': 'd', '\uFF45': 'e',
  '\uFF46': 'f', '\uFF47': 'g', '\uFF48': 'h', '\uFF49': 'i', '\uFF4A': 'j',
  '\uFF4B': 'k', '\uFF4C': 'l', '\uFF4D': 'm', '\uFF4E': 'n', '\uFF4F': 'o',
  '\uFF50': 'p', '\uFF51': 'q', '\uFF52': 'r', '\uFF53': 's', '\uFF54': 't',
  '\uFF55': 'u', '\uFF56': 'v', '\uFF57': 'w', '\uFF58': 'x', '\uFF59': 'y',
  '\uFF5A': 'z',
};

/**
 * Normalize directive text for robust pattern matching:
 * - Strip invisible/zero-width Unicode characters
 * - Replace Unicode confusables with ASCII equivalents
 * - Decode common leet-speak substitutions
 * - Collapse spaced-out letters ("i g n o r e" → "ignore")
 * - Collapse whitespace and lowercase
 */
export function normalizeText(input: string): string {
  let text = input;

  // Strip invisible characters
  text = text.replace(INVISIBLE_CHARS, '');

  // Replace Unicode confusables
  text = text.replace(/./g, (ch) => CONFUSABLE_MAP[ch] ?? ch);

  // Lowercase
  text = text.toLowerCase();

  // Decode leet-speak (only single-char substitutions in word context)
  text = text.replace(/[013457@$!]/g, (ch) => LEET_MAP[ch] ?? ch);

  // Collapse spaced-out single letters: "i g n o r e" → "ignore"
  // Match sequences of single letter + space repeated 3+ times
  text = text.replace(/\b([a-z])(?:\s+[a-z]){2,}\b/g, (match) =>
    match.replace(/\s+/g, '')
  );

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ── Layer 2: Multi-category pattern bank ─────────────────────────────────

// Category A: Policy/Safety override verbs + target nouns
const OVERRIDE_VERBS = '(?:ignore|override|bypass|skip|circumvent|disregard|forget|violate|break|disable|remove|deactivate|nullify|suspend|suppress|eliminate|drop|abandon|dismiss|disobey)';
const NEGATION_VERBS = '(?:do not follow|don\'t follow|stop following|stop enforcing|never follow|never enforce|cease following|quit following)';
const SAFETY_NOUNS = '(?:system|policy|policies|rules?|approval|permissions?|restrictions?|guidelines?|constraints?|guardrails?|instructions?|authorization|gating|safety|safeguards?|boundaries|limits?|protections?)';

// Category B: Disclosure/Exfiltration verbs + secret nouns
const DISCLOSURE_VERBS = '(?:reveal|expose|leak|dump|show|output|print|display|disclose|share|repeat back|read out|recite|reproduce|echo|emit|return|give me)';
const SECRET_NOUNS = '(?:secret|token|api key|private memory|system prompt|initial prompt|hidden instructions?|internal state|configuration|prompt text|original instructions?|base prompt)';

// Category D: Role/mode escalation phrases
const ESCALATION_PHRASES = [
  /\b(?:developer|admin|unrestricted|unfiltered|unlimited|god|root|sudo|superuser)\s*mode\b/,
  /\b(?:jailbreak|jail break|jailbroken)\b/,
  /\byou are now\b.{0,40}\b(?:unrestricted|unfiltered|without limits|without restrictions|without rules|without guidelines|free from)\b/,
  /\byour (?:new|real|actual|true)\s+(?:instructions?|prompt|rules?|policy|guidelines?)\b/,
  /\bfrom now on you (?:will|must|should|shall)\b.{0,60}\b(?:obey|comply|follow all|do whatever|do anything|never refuse)\b/,
  /\bpretend\b.{0,40}\b(?:no restrictions|no rules|no limits|no guidelines|no constraints|unrestricted|unfiltered)\b/,
  /\bact as if\b.{0,40}\b(?:permissions?|restrictions?|rules?|policy|guidelines?|constraints?)\b.{0,20}\b(?:don't|do not|doesn't|does not|did not|didn't)\b/,
  /\byou have\s+(?:full|complete|total|unlimited|unrestricted)\s+(?:\w+\s+)?(?:access|permissions?|authorization|control)\b/,
  /\btreat\s+(?:all|every)\b.{0,40}\b(?:operator|admin|owner|administrator)\b/,
];

// Category E: Approval/memory tampering phrases
const APPROVAL_TAMPERING = [
  /\b(?:auto(?:-|\s)?approve|automatically approve|always approve|approve\s+all|approve\s+every)\b/,
  /\b(?:always accept|never reject|never deny|never refuse|skip\s+approval|bypass\s+approval)\b/,
  /\b(?:treat as approved|mark as active|activate all|force activate|directly activate)\b/,
  /\b(?:without\s+(?:approval|review|verification|confirmation|checking|authorization))\b/,
];

// Category F: Safety disabling
const SAFETY_DISABLE = [
  /\b(?:turn off|shut off|switch off|power off|deactivate|disable|remove|delete|erase|clear|wipe|purge)\b.{0,30}\b(?:safety|security|filter|filtering|moderation|censorship|guardrails?)\b/,
  /\b(?:no\s+(?:safety|security|content)\s+(?:filter|filtering|check|checks|moderation|restrictions))\b/,
  /\b(?:without\s+(?:safety|security|content)\s+(?:filter|filtering|check|checks|moderation|restrictions))\b/,
];

// Build the primary verb+noun patterns with generous gap
const OVERRIDE_PATTERN = new RegExp(`\\b${OVERRIDE_VERBS}\\b.{0,60}\\b${SAFETY_NOUNS}\\b`, 'i');
const NEGATION_PATTERN = new RegExp(`\\b${NEGATION_VERBS}\\b.{0,60}\\b${SAFETY_NOUNS}\\b`, 'i');
const DISCLOSURE_PATTERN = new RegExp(`\\b${DISCLOSURE_VERBS}\\b.{0,60}\\b${SECRET_NOUNS}\\b`, 'i');

// ── Layer 3: Structural heuristics ───────────────────────────────────────

const STRUCTURAL_HEURISTICS = [
  // "Your new policy/rules/instructions is/are..."
  { pattern: /\byour\s+new\s+(?:system\s+)?(?:policy|rules?|instructions?|guidelines?|prompt)\s+(?:is|are|will be|should be)\b/i, reason: 'policy_redefinition' },
  // Conditional deferred triggers: "when user says X, stop enforcing Y"
  { pattern: /\b(?:when|if|after|once)\b.{0,60}\b(?:ignore|stop|disable|bypass|override|forget|drop|abandon)\b.{0,40}\b(?:safety|rules?|policy|guidelines?|restrictions?|guardrails?)\b/i, reason: 'conditional_unsafe_trigger' },
  // Identity swap: "respond as if you were..."
  { pattern: /\b(?:respond|reply|answer|act|behave)\b.{0,30}\b(?:as if you were|as though you are|like you are|pretending to be)\b.{0,40}\b(?:unfiltered|unrestricted|evil|uncensored|without limits)\b/i, reason: 'identity_swap' },
  // Blanket obedience: "obey all", "do whatever the user", "comply with any"
  { pattern: /\b(?:obey\s+all|do\s+whatever|do\s+anything|comply\s+with\s+(?:any|all|every)|always\s+comply|never\s+refuse|never\s+decline|never\s+deny\s+a\s+request)\b/i, reason: 'blanket_obedience' },
  // Execute without authorization: "execute any tool", "run any command"
  { pattern: /\b(?:execute|run|invoke|call|trigger)\b.{0,20}\b(?:any|all|every)\b.{0,30}\b(?:tool|command|action|function|operation)\b.{0,40}\b(?:without|no)\b.{0,20}\b(?:check|auth|approval|verification|restriction)\b/i, reason: 'unauthorized_execution' },
];

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Scans a directive string for unsafe injection patterns.
 * Applies normalization, multi-category pattern matching, and structural heuristics.
 *
 * @returns ScanResult with `safe: false` and a diagnostic `reason` if unsafe.
 */
export function scanDirective(raw: string): ScanResult {
  if (!raw || raw.trim() === '') {
    return { safe: true };
  }

  const text = normalizeText(raw);

  // Layer 2a: Override verb + safety noun
  if (OVERRIDE_PATTERN.test(text)) {
    return { safe: false, reason: 'unsafe_override' };
  }

  // Layer 2b: Negation verb + safety noun
  if (NEGATION_PATTERN.test(text)) {
    return { safe: false, reason: 'unsafe_negation' };
  }

  // Layer 2c: Disclosure verb + secret noun
  if (DISCLOSURE_PATTERN.test(text)) {
    return { safe: false, reason: 'unsafe_disclosure' };
  }

  // Layer 2d: Role/mode escalation phrases
  for (const pattern of ESCALATION_PHRASES) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'unsafe_escalation' };
    }
  }

  // Layer 2e: Approval/memory tampering
  for (const pattern of APPROVAL_TAMPERING) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'unsafe_approval_tampering' };
    }
  }

  // Layer 2f: Safety disabling
  for (const pattern of SAFETY_DISABLE) {
    if (pattern.test(text)) {
      return { safe: false, reason: 'unsafe_safety_disable' };
    }
  }

  // Layer 3: Structural heuristics
  for (const { pattern, reason } of STRUCTURAL_HEURISTICS) {
    if (pattern.test(text)) {
      return { safe: false, reason };
    }
  }

  return { safe: true };
}
