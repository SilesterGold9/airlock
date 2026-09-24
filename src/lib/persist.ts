import { useEffect, useState } from "react";

// useState backed by localStorage. Survives tab switches (pages unmount on
// route change) and restarts. Values must be JSON-serializable. Storage
// failures are swallowed: persistence is best-effort.
export function usePersistentState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // full or unavailable: ignore
    }
  }, [key, value]);

  return [value, setValue];
}
