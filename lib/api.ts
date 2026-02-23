/**
 * API client for backend (chat + document upload).
 * Base URL uses Next.js rewrite: /api/backend -> http://localhost:8000
 */

const API_BASE = "/api/backend";

export type ChatRequest = {
  message: string;
  session_id?: string | null;
  use_documents?: boolean;
};

export type ChatResponse = {
  reply: string;
  session_id: string;
  sources?: Array<Record<string, unknown>>;
};

export type UploadResponse = {
  doc_id: string;
  filename: string;
  subject?: string | null;
  chunks_stored: number;
  message: string;
};

export async function sendMessage(
  message: string,
  sessionId: string | null,
  useDocuments = true
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      use_documents: useDocuments,
    } as ChatRequest),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<ChatResponse>;
}

export async function uploadDocument(
  file: File,
  subject?: string | null
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (subject != null && subject !== "") form.append("subject", subject);
  // Send as multipart/form-data (do not set Content-Type; browser adds boundary)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UploadResponse>;
}

export async function getLLMConfig(): Promise<{ provider: string }> {
  const res = await fetch(`${API_BASE}/config/llm`);
  if (!res.ok) return { provider: "unknown" };
  return res.json() as Promise<{ provider: string }>;
}

export async function setLLMProvider(provider: string): Promise<{ provider: string }> {
  const res = await fetch(`${API_BASE}/config/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ provider: string }>;
}
