// composables/useAuth.ts

interface AuthUser {
  user_id: string;
  display_name: string;
  roles: string[];
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function useAuth() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase;

  const token = useState<string | null>("auth_token", () => null);
  const user = useState<AuthUser | null>("auth_user", () => null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loggedIn = computed(() => Boolean(token.value));

  // Restore from localStorage on client
  if (import.meta.client) {
    const initialized = useState("auth_initialized", () => false);
    if (!initialized.value) {
      const storedToken = localStorage.getItem("agentic_auth_token");
      const storedUser = localStorage.getItem("agentic_auth_user");
      if (storedToken) {
        token.value = storedToken;
      }
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser);
        } catch {
          user.value = null;
        }
      }
      initialized.value = true;
    }
  }

  function persist() {
    if (!import.meta.client) return;

    if (token.value) {
      localStorage.setItem("agentic_auth_token", token.value);
    } else {
      localStorage.removeItem("agentic_auth_token");
    }

    if (user.value) {
      localStorage.setItem("agentic_auth_user", JSON.stringify(user.value));
    } else {
      localStorage.removeItem("agentic_auth_user");
    }
  }

  async function register(params: {
    email: string;
    password: string;
    display_name: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await $fetch<AuthResponse>(`${apiBase}/auth/register`, {
        method: "POST",
        body: params,
      });

      token.value = res.token;
      user.value = res.user;
      persist();
      return res;
    } catch (err: any) {
      error.value =
        err?.data?.error ||
        err?.message ||
        "Registration failed";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function login(params: { email: string; password: string }) {
    loading.value = true;
    error.value = null;
    try {
      const res = await $fetch<AuthResponse>(`${apiBase}/auth/login`, {
        method: "POST",
        body: params,
      });

      token.value = res.token;
      user.value = res.user;
      persist();
      return res;
    } catch (err: any) {
      error.value =
        err?.data?.error ||
        err?.message ||
        "Login failed";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    persist();
  }

  return {
    token,
    user,
    loggedIn,
    loading,
    error,
    register,
    login,
    logout,
  };
}
