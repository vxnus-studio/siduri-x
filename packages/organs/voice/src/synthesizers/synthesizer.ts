export interface Synthesizer {
  synthesize(text: string): Promise<Uint8Array>;
}

export const DEFAULT_MAX_VOICE_BYTES = 10 * 1024 * 1024; // 10MB limit

export async function readBoundedResponseBody(response: Response, maxBytes: number = DEFAULT_MAX_VOICE_BYTES): Promise<Uint8Array> {
  const contentLengthHeader = response?.headers?.get ? response.headers.get('content-length') : null;
  if (contentLengthHeader) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Voice response Content-Length (${declaredLength} bytes) exceeds limit of ${maxBytes} bytes`);
    }
  }

  if (response.body && typeof (response.body as any).getReader === 'function') {
    const reader = (response.body as any).getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > maxBytes) {
            await reader.cancel();
            throw new Error(`Voice response stream exceeded maximum allowed size of ${maxBytes} bytes`);
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock?.();
    }

    const merged = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Voice response body (${buffer.byteLength} bytes) exceeds maximum limit of ${maxBytes} bytes`);
  }
  return new Uint8Array(buffer);
}
