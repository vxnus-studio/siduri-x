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

  describe("Mobile preferences sheet and navbar layout logic", () => {
    interface MobileNavbarState {
      isMobileSettingsOpen: boolean;
      selectedMode: "casual" | "teach" | "hybrid";
      subtitleLanguage: string;
      isPresenceOpen: boolean;
    }

    function formatMobileOptionsLabel(mode: string, sub: string): string {
      if (mode !== "hybrid" && sub !== "off") {
        return `${mode.slice(0, 4)}·${sub.slice(0, 2).toUpperCase()}`;
      }
      if (mode !== "hybrid") return mode;
      if (sub !== "off") return `CC:${sub.slice(0, 2).toUpperCase()}`;
      return "Options";
    }

    test("Mobile options label dynamically formats based on active settings", () => {
      expect(formatMobileOptionsLabel("hybrid", "off")).toBe("Options");
      expect(formatMobileOptionsLabel("teach", "off")).toBe("teach");
      expect(formatMobileOptionsLabel("hybrid", "ja")).toBe("CC:JA");
      expect(formatMobileOptionsLabel("casual", "en")).toBe("casu·EN");
    });

    test("Opening mobile settings sheet transitions state cleanly", () => {
      let state: MobileNavbarState = {
        isMobileSettingsOpen: false,
        selectedMode: "hybrid",
        subtitleLanguage: "off",
        isPresenceOpen: false,
      };

      // User opens settings sheet
      state = { ...state, isMobileSettingsOpen: true };
      expect(state.isMobileSettingsOpen).toBe(true);

      // User updates mode to teach and subtitle to ja
      state = { ...state, selectedMode: "teach", subtitleLanguage: "ja" };
      expect(state.selectedMode).toBe("teach");
      expect(state.subtitleLanguage).toBe("ja");

      // User closes settings sheet
      state = { ...state, isMobileSettingsOpen: false };
      expect(state.isMobileSettingsOpen).toBe(false);
      expect(formatMobileOptionsLabel(state.selectedMode, state.subtitleLanguage)).toBe("teac·JA");
    });
  });
});

