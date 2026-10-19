let csrf: string | null = null;
export function setCsrf(value: string | null) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method = options.method || 'GET';
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      signal: options.signal,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(
      'Cannot connect to FOODIO. Check your connection and try again.',
      0,
      'NETWORK',
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
      'INVALID_RESPONSE',
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error || 'Something went wrong.',
      response.status,
      data.code || 'ERROR',
    );
  return data as T;
}
export const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const dateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
export const statusLabel = (s: string) =>
  ({
    placed: 'Order placed',
    confirmed: 'Confirmed',
    preparing: 'In the kitchen',
    out_for_delivery: 'On the way',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  })[s] || s;
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';
export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
