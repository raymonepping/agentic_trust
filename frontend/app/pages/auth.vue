<script setup lang="ts">
import { useAuth } from "../composables/useAuth";
const { loggedIn, user, loading, error, login, register } = useAuth();
const router = useRouter();

const mode = ref<"login" | "register">("login");

const email = ref("");
const password = ref("");
const displayName = ref("");

const formError = computed(() => error.value);

async function handleSubmit() {
  if (!email.value.trim() || !password.value.trim()) {
    return;
  }

  try {
    if (mode.value === "register") {
      if (!displayName.value.trim()) {
        return;
      }
      await register({
        email: email.value.trim(),
        password: password.value,
        display_name: displayName.value.trim(),
      });
    } else {
      await login({
        email: email.value.trim(),
        password: password.value,
      });
    }

    // After successful auth, send them to missions
    router.push("/missions");
  } catch {
    // error state is already set in composable
  }
}

watch(
  () => loggedIn.value,
  (v) => {
    if (v) {
      // Already logged in - send to missions
      router.push("/missions");
    }
  },
);
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-950 text-gray-100">
    <AppHeader />

    <main class="flex-1 flex items-center justify-center px-4 py-10">
      <UCard class="card-strong max-w-md w-full">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-xl font-semibold">
                Agentic Trust access
              </h1>
              <p class="mt-1 text-sm text-gray-400">
                Sign in to create and query missions tied to your identity.
              </p>
            </div>

            <UBadge color="gray" variant="soft">
              {{ mode === "login" ? "Sign in" : "Register" }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex gap-2">
            <UButton
              class="flex-1"
              :variant="mode === 'login' ? 'solid' : 'ghost'"
              size="sm"
              @click="mode = 'login'"
            >
              Sign in
            </UButton>
            <UButton
              class="flex-1"
              :variant="mode === 'register' ? 'solid' : 'ghost'"
              size="sm"
              @click="mode = 'register'"
            >
              Register
            </UButton>
          </div>

          <UFormField
            name="email"
            label="Email"
          >
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
            />
          </UFormField>

          <UFormField
            v-if="mode === 'register'"
            name="display_name"
            label="Display name"
          >
            <UInput
              v-model="displayName"
              placeholder="How missions will show your name"
              autocomplete="name"
            />
          </UFormField>

          <UFormField
            name="password"
            label="Password"
          >
            <UInput
              v-model="password"
              type="password"
              placeholder="Your password"
              autocomplete="current-password"
            />
          </UFormField>

          <div
            v-if="formError"
            class="mt-1"
          >
            <UAlert
              color="red"
              variant="subtle"
              icon="i-lucide-alert-triangle"
              title="Authentication problem"
            >
              <p class="text-xs">
                {{ formError }}
              </p>
            </UAlert>
          </div>

          <UButton
            block
            :loading="loading"
            :disabled="loading"
            icon="i-lucide-log-in"
            @click="handleSubmit"
          >
            {{ mode === "login" ? "Sign in" : "Create account" }}
          </UButton>

          <p class="mt-2 text-xs text-gray-500">
            Your email is tokenized and passwords are stored with Argon2 and a Vault managed pepper.
          </p>
        </div>

        <template
          v-if="loggedIn && user"
          #footer
        >
          <p class="text-xs text-gray-400">
            Signed in as
            <span class="font-mono text-gray-200">
              {{ user.display_name }} ({{ user.user_id }})
            </span>
          </p>
        </template>
      </UCard>
    </main>

    <AppFooter />
  </div>
</template>
