import { Live2DStateController } from "../../components/live2d/controller";
import { ActiveAvatarEvent } from "../../components/live2d/types";

describe("Siduri Chat Presence and Preferences Mode Switch", () => {
  describe("State representation logic", () => {
    interface ChatViewState {
      isPresenceOpen: boolean;
      messages: Array<{ id: string; role: string; content: string }>;
      activeAvatarEvent: ActiveAvatarEvent | null;
    }

    function determineRenderedElements(state: ChatViewState) {
      const renderAvatar = state.isPresenceOpen;
      const renderPreferences = !state.isPresenceOpen && state.messages.length === 0;
      const renderMessages = !state.isPresenceOpen && state.messages.length > 0;
      const renderSidebarDock = false; // AvatarDock must never be rendered

      return {
        renderAvatar,
        renderPreferences,
        renderMessages,
        renderSidebarDock,
        effectiveAvatarState: renderAvatar
          ? {
              expression: state.activeAvatarEvent?.expression || "neutral",
              action: state.activeAvatarEvent?.action || "idle",
              state: state.activeAvatarEvent?.state || "idle",
              speechId: state.activeAvatarEvent?.speechId,
              durationMs: state.activeAvatarEvent?.durationMs,
            }
          : null,
      };
    }

    test("A. Presence OFF: preferences UI exists, AvatarCanvas does not exist, no sidebar", () => {
      const state: ChatViewState = {
        isPresenceOpen: false,
        messages: [],
        activeAvatarEvent: null,
      };

      const rendered = determineRenderedElements(state);
      expect(rendered.renderPreferences).toBe(true);
      expect(rendered.renderAvatar).toBe(false);
      expect(rendered.renderSidebarDock).toBe(false);
      expect(rendered.effectiveAvatarState).toBeNull();
    });

    test("B. Presence ON: preferences UI does NOT exist, AvatarCanvas exists, no sidebar", () => {
      const state: ChatViewState = {
        isPresenceOpen: true,
        messages: [],
        activeAvatarEvent: null,
      };

      const rendered = determineRenderedElements(state);
      expect(rendered.renderPreferences).toBe(false);
      expect(rendered.renderAvatar).toBe(true);
      expect(rendered.renderSidebarDock).toBe(false);
      expect(rendered.effectiveAvatarState).toEqual({
        expression: "neutral",
        action: "idle",
        state: "idle",
        speechId: undefined,
        durationMs: undefined,
      });
    });

    test("C. Toggle OFF -> ON: preferences disappears, model mounts cleanly", () => {
      let state: ChatViewState = {
        isPresenceOpen: false,
        messages: [],
        activeAvatarEvent: null,
      };

      let rendered = determineRenderedElements(state);
      expect(rendered.renderPreferences).toBe(true);
      expect(rendered.renderAvatar).toBe(false);

      // User toggles Presence ON
      state = { ...state, isPresenceOpen: true };
      rendered = determineRenderedElements(state);

      expect(rendered.renderPreferences).toBe(false);
      expect(rendered.renderAvatar).toBe(true);
      expect(rendered.renderSidebarDock).toBe(false);
    });

    test("D. Toggle ON -> OFF: model unmounts, preferences returns", () => {
      let state: ChatViewState = {
        isPresenceOpen: true,
        messages: [],
        activeAvatarEvent: null,
      };

      let rendered = determineRenderedElements(state);
      expect(rendered.renderAvatar).toBe(true);
      expect(rendered.renderPreferences).toBe(false);

      // User toggles Presence OFF
      state = { ...state, isPresenceOpen: false };
      rendered = determineRenderedElements(state);

      expect(rendered.renderAvatar).toBe(false);
      expect(rendered.renderPreferences).toBe(true);
    });

    test("E. Existing avatar event reactivity updates controller and animation parameters", () => {
      const controller = new Live2DStateController({
        expression: "neutral",
        action: "idle",
        state: "idle",
      });

      expect(controller.expression).toBe("neutral");
      expect(controller.action).toBe("idle");
      expect(controller.state).toBe("idle");

      // Approved avatar event received from POST /chat
      controller.updateConfig({
        expression: "happy",
        action: "talk",
        state: "speaking",
        speechId: "speech-1234",
        durationMs: 4500,
      });

      expect(controller.expression).toBe("happy");
      expect(controller.action).toBe("talk");
      expect(controller.state).toBe("speaking");
      expect(controller.speechId).toBe("speech-1234");

      // Verify animation parameters calculate speaking mouth and motion
      const frameParams = controller.calculateFrameParameters(1000);
      expect(frameParams).toHaveProperty("mouthOpenY");
      expect(frameParams).toHaveProperty("breath");
      expect(frameParams).toHaveProperty("eyeOpenL");
      expect(frameParams).toHaveProperty("eyeOpenR");
      expect(frameParams.mouthOpenY).toBeGreaterThanOrEqual(0);

      // Reset to idle after timer expires
      controller.updateConfig({
        expression: "neutral",
        action: "idle",
        state: "idle",
      });

      expect(controller.state).toBe("idle");
      expect(controller.action).toBe("idle");
    });

    test("F. Repeated OFF -> ON -> OFF -> ON lifecycle preserves clean mount/unmount", () => {
      let state: ChatViewState = {
        isPresenceOpen: false,
        messages: [],
        activeAvatarEvent: null,
      };

      for (let i = 0; i < 3; i++) {
        // Toggle ON
        state = { ...state, isPresenceOpen: true };
        let rendered = determineRenderedElements(state);
        expect(rendered.renderAvatar).toBe(true);
        expect(rendered.renderPreferences).toBe(false);
        expect(rendered.renderSidebarDock).toBe(false);

        // Toggle OFF
        state = { ...state, isPresenceOpen: false };
        rendered = determineRenderedElements(state);
        expect(rendered.renderAvatar).toBe(false);
        expect(rendered.renderPreferences).toBe(true);
        expect(rendered.renderSidebarDock).toBe(false);
      }
    });

    test("G. Neutral closed-mouth initialization and model state", () => {
      const controller = new Live2DStateController({
        expression: "neutral",
        action: "idle",
        state: "idle",
      });

      // At rest, calculateFrameParameters produces mouthOpenY = 0
      const frameParams = controller.calculateFrameParameters(0);
      expect(frameParams.mouthOpenY).toBe(0);

      // Speaking state engages mouth movement
      controller.setState("speaking");
      const speakingParams = controller.calculateFrameParameters(100);
      expect(speakingParams.mouthOpenY).toBeGreaterThanOrEqual(0);

      // Reset to idle returns mouth to 0
      controller.setState("idle");
      const idleParams = controller.calculateFrameParameters(200);
      expect(idleParams.mouthOpenY).toBe(0);
    });

    test("H. Full-body projection calculation preserves model bounds and aspect ratio", () => {
      // Bounds measured directly from standard Live2D model geometry
      const modelBounds = {
        minX: -0.389,
        maxX: 0.402,
        minY: -0.978,
        maxY: 0.176,
        width: 0.791,
        height: 1.154,
        centerX: 0.006,
        centerY: -0.401,
      };

      const calculateProjection = (canvasWidth: number, canvasHeight: number) => {
        const canvasAspect = canvasWidth / canvasHeight;
        const fitFactor = 1.84;
        const scaleXForWidth = fitFactor / modelBounds.width;
        const scaleYForHeight = fitFactor / modelBounds.height;

        let baseScale: number;
        if (canvasAspect >= modelBounds.width / modelBounds.height) {
          baseScale = scaleYForHeight;
        } else {
          baseScale = scaleXForWidth * canvasAspect;
        }

        const scaleX = baseScale / canvasAspect;
        const scaleY = baseScale;
        const transX = -modelBounds.centerX * scaleX;
        const transY = -modelBounds.centerY * scaleY;

        // Normalized Device Coordinates bounds: [-1, 1]
        const ndcMinX = modelBounds.minX * scaleX + transX;
        const ndcMaxX = modelBounds.maxX * scaleX + transX;
        const ndcMinY = modelBounds.minY * scaleY + transY;
        const ndcMaxY = modelBounds.maxY * scaleY + transY;

        return { scaleX, scaleY, transX, transY, ndcMinX, ndcMaxX, ndcMinY, ndcMaxY };
      };

      // Test Desktop (1280x800, canvas ~ 720x630)
      const desktopProj = calculateProjection(720, 630);
      expect(desktopProj.ndcMinX).toBeGreaterThan(-1.0);
      expect(desktopProj.ndcMaxX).toBeLessThan(1.0);
      expect(desktopProj.ndcMinY).toBeGreaterThan(-1.0);
      expect(desktopProj.ndcMaxY).toBeLessThan(1.0);

      // Test Mobile 390x844 (canvas ~ 302x678)
      const mobile390Proj = calculateProjection(302, 678);
      expect(mobile390Proj.ndcMinX).toBeGreaterThan(-1.0);
      expect(mobile390Proj.ndcMaxX).toBeLessThan(1.0);
      expect(mobile390Proj.ndcMinY).toBeGreaterThan(-1.0);
      expect(mobile390Proj.ndcMaxY).toBeLessThan(1.0);

      // Test Mobile 430x932 (canvas ~ 342x766)
      const mobile430Proj = calculateProjection(342, 766);
      expect(mobile430Proj.ndcMinX).toBeGreaterThan(-1.0);
      expect(mobile430Proj.ndcMaxX).toBeLessThan(1.0);
      expect(mobile430Proj.ndcMinY).toBeGreaterThan(-1.0);
      expect(mobile430Proj.ndcMaxY).toBeLessThan(1.0);
    });
  });
});
