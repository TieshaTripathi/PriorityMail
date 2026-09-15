import { useEffect, useState } from 'react';

export function useStored<T>(key: string, initial: T, validate: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`prioritymail.web.v1.${key}`);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return validate(parsed) ? parsed : initial;
    } catch { return initial; }
  });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(`prioritymail.web.v1.${key}`, JSON.stringify(value)); setFailed(false); }
    catch { setFailed(true); }
  }, [key, value]);
  return [value, setValue, failed] as const;
}
