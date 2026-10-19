import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from './api';
export function useResource<T>(path: string, poll = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    async function fetchData() {
      try {
        const d = await api<T>(path, { signal: controller.signal });
        if (active) {
          setData(d);
          setError('');
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    const t = poll ? setInterval(fetchData, poll) : null;
    return () => {
      active = false;
      controller.abort();
      if (t) clearInterval(t);
    };
  }, [path, version, poll]);
  return { data, error, loading, reload, setData };
}
