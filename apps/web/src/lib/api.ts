export const API_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || '')
  : (process.env.API_URL || 'http://localhost:3000');

export const WS_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`)
  : 'ws://127.0.0.1:8089';

export async function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, options);
}

export async function getJson<T = any>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchApi(path, options);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function postJson<T = any>(path: string, body?: any): Promise<T> {
  const response = await fetchApi(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text);
  }
  return response.json().catch(() => ({} as T));
}

export async function putJson(path: string, body: string): Promise<void> {
  const response = await fetchApi(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text);
  }
}

export async function postAction(path: string, body?: any): Promise<void> {
  const response = await fetchApi(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text);
  }
}

export interface StreamChatHandlers {
  onStaged?: (data: { response_id?: string; correlation_id?: string; status?: string }) => void;
  onChunk?: (chunk: { utteranceId: string; index: number; deltaText: string; isComplete: boolean; visemes?: any[]; expression?: string; action?: string; interrupted?: boolean }) => void;
  onAvatar?: (event: { event_id: string; expression?: string; action?: string; durationMs?: number }) => void;
  onDone?: (fullResponse: any) => void;
  onInterrupted?: (data: { reason?: string }) => void;
  onError?: (error: any) => void;
}

export async function postStream(
  path: string,
  body: any,
  handlers: StreamChatHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetchApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("ReadableStream not supported in response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "message";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          const rawData = trimmed.slice(5).trim();
          try {
            const data = JSON.parse(rawData);
            switch (currentEvent) {
              case "staged":
                handlers.onStaged?.(data);
                break;
              case "chunk":
                handlers.onChunk?.(data);
                break;
              case "avatar":
                handlers.onAvatar?.(data);
                break;
              case "done":
                handlers.onDone?.(data);
                break;
              case "interrupted":
                handlers.onInterrupted?.(data);
                break;
              case "error":
                handlers.onError?.(new Error(data.error || "Stream error"));
                break;
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      }
    }
  } catch (err: any) {
    if (signal?.aborted) {
      handlers.onInterrupted?.({ reason: signal.reason });
    } else {
      handlers.onError?.(err);
      throw err;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function interruptChat(companionId: string = "default", reason: string = "user_barge_in"): Promise<void> {
  await postJson("/chat/interrupt", { companionId, reason }).catch(() => {});
}
