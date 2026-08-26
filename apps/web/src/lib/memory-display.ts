type ClaimLike = {
  subject?: string;
  predicate?: string;
  value?: string;
  content?: string;
};

type RuntimeEffectLike = ClaimLike & {
  memory_class?: string;
  behavior?: { instruction?: string };
};

const SELF_SUBJECTS = new Set(["siduri", "self", "companion"]);
const USER_SUBJECTS = new Set(["primary_user", "user", "actor", "master", "master_private"]);

function words(value: string): string {
  return value.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
}

function sentence(value: string): string {
  const trimmed = value.trim();
  return trimmed && !/[.!?]$/.test(trimmed) ? `${trimmed}.` : trimmed;
}

function possessive(value: string): string {
  return /s$/i.test(value) ? `${value}'` : `${value}'s`;
}

export function formatClaimReceipt(item: ClaimLike): string {
  const subject = item.subject?.trim() ?? "";
  const normalizedSubject = subject.toLowerCase();
  const predicate = item.predicate?.trim() ?? "";
  const normalizedPredicate = predicate.toLowerCase();
  const value = item.value?.trim() ?? "";

  if (!subject || !predicate || !value) return sentence(item.content ?? value);

  if (SELF_SUBJECTS.has(normalizedSubject)) {
    if (normalizedPredicate === "name") return sentence(`Companion name is ${value}`);
    return sentence(`Companion ${words(predicate)} is ${value}`);
  }

  if (USER_SUBJECTS.has(normalizedSubject)) {
    if (normalizedPredicate === "name") return sentence(`User name is ${value}`);
    if (normalizedPredicate === "preferred_address") return sentence(`User preferred address is ${value}`);
    if (normalizedPredicate === "relationship_to_siduri" || normalizedPredicate === "relationship") {
      return sentence(`User role configured as ${value}`);
    }
    return sentence(`User ${words(predicate)} is ${value}`);
  }

  if (normalizedSubject.startsWith("primary_user.") || normalizedSubject.startsWith("user.")) {
    const prefix = normalizedSubject.startsWith("primary_user.") ? "primary_user." : "user.";
    const area = words(subject.slice(prefix.length));
    const label = normalizedPredicate === "uid" || normalizedPredicate === "id" ? "ID" : words(predicate);
    return sentence(`User ${area} ${label} is ${value}`);
  }

  const label = words(subject);
  return sentence(`${possessive(label)} ${words(predicate)} is ${value}`);
}

export function formatRuntimeEffect(item: RuntimeEffectLike): string {
  const subject = item.subject?.trim().toLowerCase() ?? "";
  const predicate = item.predicate?.trim().toLowerCase() ?? "";
  const value = item.value?.trim() ?? "";
  const instruction = item.behavior?.instruction?.trim() ?? "";

  if (item.memory_class === "behavioral" && instruction) return sentence(instruction);
  if (SELF_SUBJECTS.has(subject) && predicate === "name") return sentence(`Set companion identity/name to ${value}`);
  if (SELF_SUBJECTS.has(subject)) return sentence(`Set companion ${words(predicate)} to ${value}`);
  if (USER_SUBJECTS.has(subject) && (predicate === "relationship_to_siduri" || predicate === "relationship")) {
    return sentence(`Set user role to ${value}`);
  }
  if (USER_SUBJECTS.has(subject) && predicate === "name") return sentence(`Set user name to ${value}`);
  return formatClaimReceipt(item);
}
