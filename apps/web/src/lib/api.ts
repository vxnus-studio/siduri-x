export const API_URL = "http://localhost:3001";
export const WS_URL = "ws://127.0.0.1:8089";

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
