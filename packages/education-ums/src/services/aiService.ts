/**
 * BMI UMS - AI Service
 * Connects to local Ollama backend for AI chat responses
 */

import { getToken } from './authService';
import { API_URL } from './config';

// Single source of truth for the API base URL is `./config.ts`. In production
// builds `config.ts` falls back to https://api.bmiuniversities.org
// unless VITE_API_URL is provided at build time.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionResponse {
  message: ChatMessage;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Get AI response from local Ollama LLM
 * Supports both new message array format and legacy string prompt format
 */
export async function getAIResponse(
  messages: ChatMessage[] | string,
  systemPrompt?: string
): Promise<string> {
  // Handle legacy string prompt format
  if (typeof messages === 'string') {
    const chatMessages: ChatMessage[] = [
      { role: 'user', content: messages }
    ];
    if (systemPrompt) {
      chatMessages.unshift({ role: 'system', content: systemPrompt });
    }
    return getAIResponseFromMessages(chatMessages);
  }
  
  return getAIResponseFromMessages(messages);
}

/**
 * Internal function to get AI response from message array
 */
async function getAIResponseFromMessages(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify({
        messages,
        system_prompt: systemPrompt,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'AI request failed');
    }

    return data.data.response;
  } catch (error) { // eslint-disable-next-line no-console
    console.error('AI service error:', error);
    
    // Check if backend is available
    const backendAvailable = await isBackendAvailable();
    if (!backendAvailable) {
      return '⚠️ AI service is currently unavailable. Please ensure the backend is running and Ollama is installed. Run: `ollama pull llama3.2`';
     }
    
    return '⚠️ I apologize, but I am unable to process your request at the moment. Please try again later.';
  }
}

/**
 * OpenAI-compatible chat completions endpoint
 */
export async function chatCompletions(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }
): Promise<ChatCompletionResponse> {
  const response = await fetch(`${API_URL}/ai/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({
      messages,
      model: options?.model || 'llama3.2',
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 2048,
      stream: options?.stream ?? false,
    }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Chat completion failed');
  }

  return data.data;
}

async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if AI service is available
 */
export async function isAIServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return data.success && data.services?.ai !== 'offline';
  } catch {
    return false;
  }
}

// Legacy compatibility - export as geminiService interface
export const getGeminiResponse = getAIResponse;









