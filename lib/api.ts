export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers: initHeaders, ...rest } = options ?? {};
  const headers = new Headers(initHeaders);

  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  const res = await fetch(path.startsWith('/') ? path : `/${path}`, {
    ...rest,
    headers,
    body,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === 'object' && payload && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : typeof payload === 'string' && payload
            ? payload
            : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return payload as T;
}
