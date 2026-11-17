export async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text || text.trim() === '') return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}









