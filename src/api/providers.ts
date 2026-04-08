// Futurescape API provider - DeepSeek
// Simplified: single provider, key loaded from environment

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

// API key from Vite environment variable
let apiKey: string | null = import.meta.env.VITE_DEEPSEEK_API_KEY || null;

export function setApiKey(key: string) {
  apiKey = key;
}

export function getApiKey(): string | null {
  return apiKey;
}

export function hasApiKey(): boolean {
  return !!apiKey;
}

// No-op for backward compat
export function loadSavedConfig() {}

// Call the DeepSeek API (OpenAI-compatible format)
export async function callProviderAPI(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key not configured. Please set VITE_DEEPSEEK_API_KEY in .env');
  }

  const allMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: allMessages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
    handleAPIError(response.status, errorData);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function handleAPIError(status: number, errorData: any): never {
  if (status === 401) {
    throw new Error('Invalid API key. Please check the configuration.');
  }
  if (status === 429) {
    throw new Error('Rate limit exceeded. Please wait a moment and try again.');
  }
  if (status === 402) {
    throw new Error('Insufficient credits. Please add credits to the account.');
  }

  const message = errorData?.error?.message || errorData?.message || `API error: ${status}`;
  throw new Error(message);
}
