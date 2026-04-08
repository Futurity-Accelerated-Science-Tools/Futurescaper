// API client that calls our backend (which handles the DeepSeek API key)

const API_BASE = import.meta.env.PROD
  ? '/api'  // In production, same origin
  : 'http://localhost:3001/api';  // In development, separate server

export async function callAPI(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      systemPrompt,
      maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}

// Always ready since backend handles the API key
export function hasApiKey(): boolean {
  return true;
}

export function setApiKey(_key: string): void {
  // No-op - backend handles API key
}

export function getApiKey(): string | null {
  return 'backend-managed';
}
