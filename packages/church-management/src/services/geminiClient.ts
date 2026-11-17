/**
 * Gemini AI Client
 *
 * Attempts to call the server-side proxy first.
 * Falls back to direct browser API only if VITE_AI_API_KEY is explicitly set
 * (local development without the proxy running).
 */

const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL || 'https://hkm-gemini-proxy.your-domain.workers.dev';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

export async function generateWithGemini(
  prompt: string,
  options?: { systemInstruction?: string; model?: string },
): Promise<string> {
  const model = options?.model || 'gemini-2.0-flash';

  if (import.meta.env.VITE_AI_API_KEY) {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_AI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: options?.systemInstruction ? { systemInstruction: options.systemInstruction } : undefined,
    });
    return response.text || '';
  }

  const res = await fetch(`${PROXY_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction: options?.systemInstruction, model }),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Gemini proxy returned ${res.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
