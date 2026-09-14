describe("Chat Message Avatar and Thinking Indicator Logic", () => {
  interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
  }

  interface ChatRenderState {
    messages: ChatMessage[];
    busy: boolean;
    isPresenceOpen: boolean;
  }

  function computeRenderedAvatars(state: ChatRenderState): Array<{ role: string; avatarLabel: string; isThinking: boolean; content: string }> {
    const rendered: Array<{ role: string; avatarLabel: string; isThinking: boolean; content: string }> = [];

    // Message list rendering
    for (const item of state.messages) {
      const isAssistantThinking = item.role === "assistant" && !item.content && state.busy;
      rendered.push({
        role: item.role,
        avatarLabel: item.role === "user" ? "U" : "S",
        isThinking: isAssistantThinking,
        content: item.content,
      });
    }

    // Standalone thinking indicator only when busy, presence closed, and no assistant message present
    const shouldRenderStandaloneThinking =
      state.busy &&
      !state.isPresenceOpen &&
      (!state.messages.length || state.messages[state.messages.length - 1]?.role !== "assistant");

    if (shouldRenderStandaloneThinking) {
      rendered.push({
        role: "assistant",
        avatarLabel: "S",
        isThinking: true,
        content: "",
      });
    }

    return rendered;
  }

  test("Initial state with empty messages has 0 avatars", () => {
    const state: ChatRenderState = {
      messages: [],
      busy: false,
      isPresenceOpen: false,
    };
    const rendered = computeRenderedAvatars(state);
    expect(rendered).toHaveLength(0);
  });

  test("When user submits message and assistant placeholder is added, exactly ONE 'S' avatar is rendered", () => {
    const state: ChatRenderState = {
      messages: [
        { id: "user-1", role: "user", content: "Remember that I like ramen" },
        { id: "asst-1", role: "assistant", content: "" }, // Placeholder
      ],
      busy: true,
      isPresenceOpen: false,
    };

    const rendered = computeRenderedAvatars(state);
    expect(rendered).toHaveLength(2); // 1 User + 1 Assistant

    const sAvatars = rendered.filter((r) => r.avatarLabel === "S");
    expect(sAvatars).toHaveLength(1);
    expect(sAvatars[0].isThinking).toBe(true);
  });

  test("While assistant response is streaming, exactly ONE 'S' avatar is rendered", () => {
    const state: ChatRenderState = {
      messages: [
        { id: "user-1", role: "user", content: "Remember that I like ramen" },
        { id: "asst-1", role: "assistant", content: "I'll remember that" }, // Partial chunk
      ],
      busy: true,
      isPresenceOpen: false,
    };

    const rendered = computeRenderedAvatars(state);
    expect(rendered).toHaveLength(2);

    const sAvatars = rendered.filter((r) => r.avatarLabel === "S");
    expect(sAvatars).toHaveLength(1);
    expect(sAvatars[0].isThinking).toBe(false);
    expect(sAvatars[0].content).toBe("I'll remember that");
  });

  test("When response is done, exactly ONE 'S' avatar is rendered", () => {
    const state: ChatRenderState = {
      messages: [
        { id: "user-1", role: "user", content: "Remember that I like ramen" },
        { id: "asst-1", role: "assistant", content: "Got it! I will remember you love ramen." },
      ],
      busy: false,
      isPresenceOpen: false,
    };

    const rendered = computeRenderedAvatars(state);
    expect(rendered).toHaveLength(2);

    const sAvatars = rendered.filter((r) => r.avatarLabel === "S");
    expect(sAvatars).toHaveLength(1);
    expect(sAvatars[0].isThinking).toBe(false);
  });
});
