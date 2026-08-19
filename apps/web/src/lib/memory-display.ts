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

const SELF_SUBJECTS = new Set(["siduri", "self"]);
const USER_SUBJECTS = new Set(["primary_user", "user", "master", "master_private"]);

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
    return sentence(normalizedPredicate === "name" ? `My name is ${value}` : `My ${words(predicate)} is ${value}`);
  }

  if (USER_SUBJECTS.has(normalizedSubject)) {
    if (normalizedPredicate === "name") return sentence(`Your name is ${value}`);
    if (normalizedPredicate === "preferred_address") return sentence(`You prefer to be addressed as ${value}`);
    if (normalizedPredicate === "relationship_to_siduri") return sentence(`You are my ${value}`);
    return sentence(`Your ${words(predicate)} is ${value}`);
  }

  if (normalizedSubject.startsWith("primary_user.")) {
    const area = words(subject.slice("primary_user.".length));
    const label = normalizedPredicate === "uid" ? "UID" : words(predicate);
    return sentence(`Your ${area} ${label} is ${value}`);
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
  if (SELF_SUBJECTS.has(subject) && predicate === "name") return sentence(`Use ${value} as my identity/name`);
  if (SELF_SUBJECTS.has(subject)) return sentence(`Use ${value} as my ${words(predicate)}`);
  if (USER_SUBJECTS.has(subject) && predicate === "relationship_to_siduri") return sentence(`Recognize you as my ${value}`);
  if (USER_SUBJECTS.has(subject) && predicate === "name") return sentence(`Recognize ${value} as your name`);
  return formatClaimReceipt(item);
}
