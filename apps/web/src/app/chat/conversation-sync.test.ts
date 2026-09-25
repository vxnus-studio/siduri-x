describe("Conversation Multi-Machine Synchronization Logic", () => {
  interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
    [key: string]: any;
  }

  interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: number;
  }

  function mergeConversations(
    localConvs: Conversation[],
    serverConvs: Conversation[],
  ): Conversation[] {
    const localMap = new Map(localConvs.map((c) => [c.id, c]));
    for (const sConv of serverConvs) {
      const local = localMap.get(sConv.id);
      if (!local || (sConv.updatedAt || 0) >= (local.updatedAt || 0)) {
        localMap.set(sConv.id, sConv);
      }
    }
    return Array.from(localMap.values()).sort(
      (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    );
  }

  test("Hydrates complete conversation history when opening on a brand new machine with empty local storage", () => {
    const localConvs: Conversation[] = [];
    const serverConvs: Conversation[] = [
      {
        id: "conv-1",
        title: "Session 1 on Machine A",
        updatedAt: 1000,
        messages: [
          { id: "m1", role: "user", content: "Hi from Machine A", createdAt: 900 },
          { id: "m2", role: "assistant", content: "Greetings", createdAt: 950 },
        ],
      },
      {
        id: "conv-2",
        title: "Session 2 on Machine A",
        updatedAt: 2000,
        messages: [
          { id: "m3", role: "user", content: "Second chat", createdAt: 1900 },
        ],
      },
    ];

    const merged = mergeConversations(localConvs, serverConvs);
    expect(merged).toHaveLength(2);
    // Ordered by updatedAt descending
    expect(merged[0].id).toBe("conv-2");
    expect(merged[1].id).toBe("conv-1");
    expect(merged[1].messages).toHaveLength(2);
  });

  test("Resolves updates in favor of newer timestamps across machines", () => {
    const localConvs: Conversation[] = [
      {
        id: "conv-1",
        title: "Session 1",
        updatedAt: 1000,
        messages: [{ id: "m1", role: "user", content: "Old text", createdAt: 900 }],
      },
    ];

    const serverConvs: Conversation[] = [
      {
        id: "conv-1",
        title: "Session 1 (Updated on Machine B)",
        updatedAt: 1500,
        messages: [
          { id: "m1", role: "user", content: "Old text", createdAt: 900 },
          { id: "m2", role: "user", content: "New text from Machine B", createdAt: 1400 },
        ],
      },
    ];

    const merged = mergeConversations(localConvs, serverConvs);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Session 1 (Updated on Machine B)");
    expect(merged[0].messages).toHaveLength(2);
    expect(merged[0].updatedAt).toBe(1500);
  });

  test("Preserves local newer conversation if server sync is slightly delayed", () => {
    const localConvs: Conversation[] = [
      {
        id: "conv-1",
        title: "Locally edited",
        updatedAt: 3000,
        messages: [{ id: "m1", role: "user", content: "Local edit", createdAt: 3000 }],
      },
    ];

    const serverConvs: Conversation[] = [
      {
        id: "conv-1",
        title: "Old title",
        updatedAt: 1000,
        messages: [{ id: "m1", role: "user", content: "Older", createdAt: 1000 }],
      },
    ];

    const merged = mergeConversations(localConvs, serverConvs);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Locally edited");
    expect(merged[0].updatedAt).toBe(3000);
  });
});
