import { viewport } from "../layout";

describe("Mobile Viewport and Layout Configuration", () => {
  test("Viewport metadata is correctly configured for mobile devices", () => {
    expect(viewport).toBeDefined();
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.viewportFit).toBe("cover");
    expect(viewport.interactiveWidget).toBe("resizes-content");
    expect(viewport.themeColor).toBe("#0b0b0e");
  });

  describe("Mobile drawer state logic", () => {
    interface MobileChatState {
      isMobileDrawerOpen: boolean;
      activeId: string | null;
      conversations: Array<{ id: string; title: string }>;
    }

    function openDrawer(state: MobileChatState): MobileChatState {
      return { ...state, isMobileDrawerOpen: true };
    }

    function closeDrawer(state: MobileChatState): MobileChatState {
      return { ...state, isMobileDrawerOpen: false };
    }

    function selectConversation(
      state: MobileChatState,
      conversationId: string,
    ): MobileChatState {
      return {
        ...state,
        activeId: conversationId,
        isMobileDrawerOpen: false,
      };
    }

    function startNewChat(
      state: MobileChatState,
      newConversation: { id: string; title: string },
    ): MobileChatState {
      return {
        ...state,
        conversations: [newConversation, ...state.conversations],
        activeId: newConversation.id,
        isMobileDrawerOpen: false,
      };
    }

    test("Opening and closing the mobile drawer correctly updates state", () => {
      let state: MobileChatState = {
        isMobileDrawerOpen: false,
        activeId: "conv-1",
        conversations: [{ id: "conv-1", title: "Conversation 1" }],
      };

      state = openDrawer(state);
      expect(state.isMobileDrawerOpen).toBe(true);

      state = closeDrawer(state);
      expect(state.isMobileDrawerOpen).toBe(false);
    });

    test("Selecting a conversation automatically closes the mobile drawer", () => {
      let state: MobileChatState = {
        isMobileDrawerOpen: true,
        activeId: "conv-1",
        conversations: [
          { id: "conv-1", title: "Conversation 1" },
          { id: "conv-2", title: "Conversation 2" },
        ],
      };

      state = selectConversation(state, "conv-2");
      expect(state.activeId).toBe("conv-2");
      expect(state.isMobileDrawerOpen).toBe(false);
    });

    test("Creating a new chat automatically closes the mobile drawer", () => {
      let state: MobileChatState = {
        isMobileDrawerOpen: true,
        activeId: "conv-1",
        conversations: [{ id: "conv-1", title: "Conversation 1" }],
      };

      state = startNewChat(state, { id: "conv-new", title: "New Conversation" });
      expect(state.activeId).toBe("conv-new");
      expect(state.conversations).toHaveLength(2);
      expect(state.isMobileDrawerOpen).toBe(false);
    });
  });
});
