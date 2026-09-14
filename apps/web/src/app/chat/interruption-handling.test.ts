describe("Interruption and Error Handling Logic", () => {
  interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    interrupted?: boolean;
    interruptionReason?: string;
    error?: string;
    createdAt?: number;
  }

  function sanitizeMessage(msg: ChatMessage): ChatMessage {
    if (msg.content === "[interrupted]") {
      return {
        ...msg,
        content: "",
        interrupted: true,
        interruptionReason: "interrupted",
      };
    }
    if (msg.content && msg.content.endsWith(" [interrupted]")) {
      return {
        ...msg,
        content: msg.content.slice(0, -" [interrupted]".length).trim(),
        interrupted: true,
        interruptionReason: "interrupted",
      };
    }
    if (
      msg.content &&
      msg.content.startsWith("I couldn’t reach the orchestrator. ")
    ) {
      const err = msg.content.slice("I couldn’t reach the orchestrator. ".length);
      return {
        ...msg,
        content: "",
        error: err,
      };
    }
    return msg;
  }

  function handleInterrupted(
    messages: ChatMessage[],
    assistantId: string,
    reason: string,
  ): ChatMessage[] {
    const target = messages.find((m) => m.id === assistantId);
    if (reason === "user_barge_in" && (!target || !target.content.trim())) {
      return messages.filter((m) => m.id !== assistantId);
    }
    return messages.map((msg) =>
      msg.id === assistantId
        ? {
            ...msg,
            interrupted: true,
            interruptionReason: reason,
          }
        : msg,
    );
  }

  function handleError(
    messages: ChatMessage[],
    assistantId: string,
    error: string,
  ): ChatMessage[] {
    return messages.map((msg) =>
      msg.id === assistantId
        ? {
            ...msg,
            error,
          }
        : msg,
    );
  }

  test("Sanitizes legacy stored messages with [interrupted] into clean interrupted state", () => {
    const legacyEmpty = sanitizeMessage({
      id: "1",
      role: "assistant",
      content: "[interrupted]",
    });
    expect(legacyEmpty.content).toBe("");
    expect(legacyEmpty.interrupted).toBe(true);

    const legacyPartial = sanitizeMessage({
      id: "2",
      role: "assistant",
      content: "I was saying something [interrupted]",
    });
    expect(legacyPartial.content).toBe("I was saying something");
    expect(legacyPartial.interrupted).toBe(true);

    const legacyError = sanitizeMessage({
      id: "3",
      role: "assistant",
      content: "I couldn’t reach the orchestrator. TypeError: fetch failed",
    });
    expect(legacyError.content).toBe("");
    expect(legacyError.error).toBe("TypeError: fetch failed");
  });

  test("Barge-in before tokens arrive removes the ghost empty placeholder", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "First question" },
      { id: "a1", role: "assistant", content: "" }, // Placeholder
    ];

    const result = handleInterrupted(messages, "a1", "user_barge_in");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });

  test("Barge-in during streaming preserves partial text without appending [interrupted]", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "First question" },
      { id: "a1", role: "assistant", content: "I am responding to you right now..." },
    ];

    const result = handleInterrupted(messages, "a1", "user_barge_in");
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("I am responding to you right now...");
    expect(result[1].interrupted).toBe(true);
    expect(result[1].interruptionReason).toBe("user_barge_in");
  });

  test("Manual stop without tokens sets interrupted: true with empty content", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "First question" },
      { id: "a1", role: "assistant", content: "" },
    ];

    const result = handleInterrupted(messages, "a1", "user_stop");
    expect(result).toHaveLength(2);
    expect(result[1].content).toBe("");
    expect(result[1].interrupted).toBe(true);
    expect(result[1].interruptionReason).toBe("user_stop");
  });

  test("Error handling attaches error metadata without modifying speech content", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "Question" },
      { id: "a1", role: "assistant", content: "" },
    ];

    const result = handleError(messages, "a1", "Network timeout after 15000ms");
    expect(result[1].content).toBe("");
    expect(result[1].error).toBe("Network timeout after 15000ms");
  });

  test("Classifies various LLM provider errors with helpful diagnoses and hints", () => {
    const { getErrorDiagnosis } = require("./chat-client");

    const authDiag = getErrorDiagnosis("Fatal upstream API error (401): Invalid API key provided");
    expect(authDiag.title).toBe("LLM Provider Authentication Failed");
    expect(authDiag.hint).toContain("API key");

    const quotaDiag = getErrorDiagnosis("LLM provider error (402): Insufficient balance or credits");
    expect(quotaDiag.title).toBe("LLM Credits / Quota Exhausted");
    expect(quotaDiag.hint).toContain("credits");

    const rateDiag = getErrorDiagnosis("OpenRouter API error (429): Rate limit exceeded for free tier");
    expect(rateDiag.title).toBe("LLM Rate Limit Reached");
    expect(rateDiag.hint).toContain("too many requests");

    const modelDiag = getErrorDiagnosis("Fatal upstream API error (404): No model found matching 'inclusionai/ling-3.0'");
    expect(modelDiag.title).toBe("LLM Model Not Found");

    const timeoutDiag = getErrorDiagnosis("Brain request timed out after overall deadline of 30000ms");
    expect(timeoutDiag.title).toBe("LLM Request Timed Out");
  });

  test("Classifies interruption reasons into human-friendly badges, explanations, and hints", () => {
    const { getInterruptionExplanation } = require("./chat-client");

    const disconnectInfo = getInterruptionExplanation("client_disconnect");
    expect(disconnectInfo.label).toBe("Disconnected");
    expect(disconnectInfo.text).toBe("Response stopped due to connection close.");
    expect(disconnectInfo.hint).toContain("closed prematurely");

    const stopInfo = getInterruptionExplanation("user_stop");
    expect(stopInfo.label).toBe("Stopped");
    expect(stopInfo.text).toBe("Response stopped by user.");
    expect(stopInfo.hint).toContain("stop control");

    const bargeInInfo = getInterruptionExplanation("user_barge_in");
    expect(bargeInInfo.label).toBe("Interrupted");
    expect(bargeInInfo.text).toBe("Response interrupted by new message.");
    expect(bargeInInfo.hint).toContain("new prompt");

    const timeoutInfo = getInterruptionExplanation("timeout");
    expect(timeoutInfo.label).toBe("Timed Out");
    expect(timeoutInfo.text).toBe("Response timed out.");
    expect(timeoutInfo.hint).toContain("time limit");
  });
});
