import { formatClaimReceipt, formatRuntimeEffect } from "./memory-display";

describe("memory-display formatting and resilience", () => {
  describe("formatClaimReceipt", () => {
    test("handles undefined and null gracefully without throwing", () => {
      expect(() => formatClaimReceipt({})).not.toThrow();
      expect(formatClaimReceipt({})).toBe("");
      expect(formatClaimReceipt({ subject: undefined, predicate: undefined, value: undefined })).toBe("");
      expect(formatClaimReceipt({ content: undefined, value: undefined })).toBe("");
    });

    test("formats standard subject, predicate, value claims", () => {
      const formatted = formatClaimReceipt({
        subject: "user",
        predicate: "favorite_food",
        value: "ramen",
      });
      expect(formatted).toBe("User favorite food is ramen.");
    });

    test("handles companion self-subjects", () => {
      const formatted = formatClaimReceipt({
        subject: "siduri",
        predicate: "role",
        value: "bartender",
      });
      expect(formatted).toBe("Companion role is bartender.");
    });

    test("falls back to content or directive if subject/predicate/value are incomplete", () => {
      expect(formatClaimReceipt({ content: "The user likes coffee" })).toBe("The user likes coffee.");
      expect(formatClaimReceipt({ directive: "Always speak warmly" })).toBe("Always speak warmly.");
      expect(formatClaimReceipt({ value: "just-a-value" })).toBe("just-a-value.");
    });
  });

  describe("formatRuntimeEffect", () => {
    test("handles missing fields gracefully without throwing", () => {
      expect(() => formatRuntimeEffect({})).not.toThrow();
      expect(formatRuntimeEffect({})).toBe("");
    });

    test("formats behavioral instruction if available", () => {
      const formatted = formatRuntimeEffect({
        memory_class: "behavioral",
        behavior: { instruction: "Greet user in Japanese" },
      });
      expect(formatted).toBe("Greet user in Japanese.");
    });

    test("formats directive property from SelfDirective", () => {
      const formatted = formatRuntimeEffect({
        directive: "Never reveal private keys",
      } as any);
      expect(formatted).toBe("Never reveal private keys.");
    });

    test("formats companion identity effect", () => {
      const formatted = formatRuntimeEffect({
        subject: "companion",
        predicate: "name",
        value: "Siduri",
      });
      expect(formatted).toBe("Set companion identity/name to Siduri.");
    });

    test("formats user relationship effect", () => {
      const formatted = formatRuntimeEffect({
        subject: "user",
        predicate: "relationship",
        value: "trusted_partner",
      });
      expect(formatted).toBe("Set user relationship to trusted_partner.");
    });
  });
});
