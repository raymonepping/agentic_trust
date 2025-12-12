// composables/useApiClient.ts
import { useAuth } from "./useAuth";

export function useApiClient() {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBase;
  const { token } = useAuth(); // now defined

  const apiFetch = $fetch.create({
    baseURL,
    retry: 1,
    retryDelay: 500,
    onRequest({ options }) {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
      };

      if (token.value) {
        headers.Authorization = `Bearer ${token.value}`;
      }

      options.headers = headers;
    },
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
