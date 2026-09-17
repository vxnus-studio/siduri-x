describe("Operator Memory Data Representation and ID Resolution", () => {
  function shortId(value?: string | null): string {
    if (!value) return "—";
    return value.length > 19 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
  }

  test("shortId does not throw on undefined or null and returns fallback", () => {
    expect(() => shortId(undefined)).not.toThrow();
    expect(shortId(undefined)).toBe("—");
    expect(() => shortId(null)).not.toThrow();
    expect(shortId(null)).toBe("—");
    expect(shortId("")).toBe("—");
  });

  test("shortId truncates long UUIDs correctly", () => {
    const fullId = "claim-123456789-abcdef-987654321";
    expect(shortId(fullId)).toBe("claim-123…7654321");
  });

  test("shortId leaves short identifiers unchanged", () => {
    expect(shortId("claim-123")).toBe("claim-123");
  });

  describe("Backend schema compatibility with MemoryClaim and SelfDirective", () => {
    test("Resolves ID for MemoryClaim where backend provides .id instead of .claim_id", () => {
      const backendClaim = {
        id: "claim-uuid-55555555555555555555",
        companionId: "default",
        subject: "user",
        predicate: "timezone",
        value: "UTC+7",
        status: "approved",
        confidence: 1.0,
        assertedAt: "2026-09-14T07:00:00.000Z",
      };

      const resolvedId = (backendClaim as any).id || (backendClaim as any).claim_id;
      expect(resolvedId).toBe("claim-uuid-55555555555555555555");
      expect(shortId(resolvedId)).toBe("claim-uui…5555555");
    });

    test("Resolves ID for SelfDirective where backend provides .id instead of .directive_id", () => {
      const backendDirective = {
        id: "dir-uuid-99999999999999999999",
        companionId: "default",
        priority: 10,
        directive: "Keep answers concise",
        status: "active",
        category: "behavioral",
        createdAt: "2026-09-14T07:00:00.000Z",
      };

      const resolvedId = (backendDirective as any).id || (backendDirective as any).directive_id;
      expect(resolvedId).toBe("dir-uuid-99999999999999999999");
      expect(shortId(resolvedId)).toBe("dir-uuid-…9999999");
    });

    test("Resolves fact content fallback when MemoryClaim does not have .content property", () => {
      const backendItem = {
        id: "claim-1",
        subject: "user",
        predicate: "drink_preference",
        value: "matcha latte",
        status: "approved",
      };

      const factContent =
        (backendItem as any).content ||
        (backendItem.subject && backendItem.predicate
          ? `${backendItem.subject} ${backendItem.predicate} ${backendItem.value}`
          : backendItem.value || "—");

      expect(factContent).toBe("user drink_preference matcha latte");
    });

    test("Toggles task status between todo and completed correctly", () => {
      const task = { id: "t-1", title: "Test task", status: "todo" };
      const nextStatus = task.status === "completed" ? "todo" : "completed";
      expect(nextStatus).toBe("completed");

      const completedTask = { ...task, status: nextStatus };
      const toggledBack = completedTask.status === "completed" ? "todo" : "completed";
      expect(toggledBack).toBe("todo");
    });

    test("Formats entity properties safely when JSON or undefined", () => {
      const entity = {
        id: "ent-1",
        name: "Mechanical Keyboard",
        entityType: "hardware",
        domain: "workstation",
        properties: { switches: "Gateron Brown", layout: "75%" },
      };
      const jsonStr = JSON.stringify(entity.properties || {});
      expect(jsonStr).toContain("Gateron Brown");
    });
  });
});
