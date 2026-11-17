import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function safeReadLocalStorage(key: string): unknown | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = safeReadLocalStorage(key);
    if (stored !== undefined) return stored as T;
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore write errors (e.g., quota exceeded)
    }
  }, [key, state]);

  return [state, setState];
}










