// composables/useApiClient.ts
export function useApiClient() {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBase;

  const apiFetch = $fetch.create({
    baseURL,
    retry: 1,
    retryDelay: 500,
  });

  function get<T>(path: string, opts: Record<string, unknown> = {}) {
    return apiFetch<T>(path, { method: "GET", ...opts });
  }

  function post<T>(
    path: string,
    body: unknown,
    opts: Record<string, unknown> = {},
  ) {
    return apiFetch<T>(path, {
      method: "POST",
      body,
      ...opts,
    });
  }

  return {
    baseURL,
    apiFetch,
    get,
    post,
  };
}
