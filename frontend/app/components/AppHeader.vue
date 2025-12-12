<!-- app/components/AppHeader.vue -->
<template>
  <header class="w-full bg-gray-950 text-gray-100 border-b border-gray-800">
    <div class="container mx-auto flex items-center justify-between px-4 py-3">
      <!-- Logo / title -->
      <NuxtLink to="/" class="flex items-baseline gap-2">
        <span class="text-sm font-medium text-gray-400">Agentic Trust</span>
        <span class="text-xs text-gray-500">Control plane</span>
      </NuxtLink>

      <!-- Left navigation -->
      <nav class="flex items-center gap-4 text-sm">
        <NuxtLink
          to="/"
          class="text-gray-400 hover:text-primary-400 transition-colors"
        >
          Dashboard
        </NuxtLink>

        <NuxtLink
          to="/missions"
          class="text-gray-400 hover:text-primary-400 transition-colors"
        >
          Missions
        </NuxtLink>

        <NuxtLink
          to="/audit"
          class="text-gray-400 hover:text-primary-400 transition-colors"
        >
          Vault audit
        </NuxtLink>

        <a
          href="http://localhost:3001/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gray-400 hover:text-primary-400 transition-colors"
        >
          API docs
        </a>
      </nav>

      <!-- Auth status / actions -->
      <div class="flex items-center gap-3 text-xs">
        <template v-if="loggedIn && user">
          <span class="hidden sm:inline text-gray-400">
            Signed in as
            <span class="font-mono text-gray-200">
              {{ user.display_name }}
            </span>
          </span>
          <UButton
            size="xs"
            variant="ghost"
            color="gray"
            icon="i-lucide-log-out"
            @click="handleLogout"
          >
            Logout
          </UButton>
        </template>

        <template v-else>
          <UButton
            size="xs"
            variant="solid"
            color="primary"
            icon="i-lucide-log-in"
            @click="goAuth"
          >
            Sign in / Register
          </UButton>
        </template>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from "#imports";
import { useAuth } from "../composables/useAuth";

const router = useRouter();
const { loggedIn, user, logout } = useAuth();

function goAuth() {
  router.push("/auth");
}

function handleLogout() {
  logout();
  router.push("/auth");
}
</script>
