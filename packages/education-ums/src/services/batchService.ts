import { authFetch } from './authService';
import { API_URL } from './config';
import { parseJsonSafe } from './apiClient';

export type BatchResult = {
  success: boolean;
  data?: {
    createdIds: string[];
    successCount: number;
    failureCount: number;
    errors: Array<{ index: number; error: string }>;
  };
  error?: string;
};

export async function postStudentBatch(items: unknown[]): Promise<BatchResult> {
  const res = await authFetch(`${API_URL}/batch/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonSafe<BatchResult>(res);
  return data ?? { success: false, error: 'Failed to parse batch response' };
}

export async function postGradeBatch(items: unknown[]): Promise<BatchResult> {
  const res = await authFetch(`${API_URL}/batch/grades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonSafe<BatchResult>(res);
  return data ?? { success: false, error: 'Failed to parse batch response' };
}

export async function postTransactionBatch(items: unknown[]): Promise<BatchResult> {
  const res = await authFetch(`${API_URL}/batch/finance/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonSafe<BatchResult>(res);
  return data ?? { success: false, error: 'Failed to parse batch response' };
}

export async function postCourseBatch(items: unknown[]): Promise<BatchResult> {
  const res = await authFetch(`${API_URL}/batch/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonSafe<BatchResult>(res);
  return data ?? { success: false, error: 'Failed to parse batch response' };
}









