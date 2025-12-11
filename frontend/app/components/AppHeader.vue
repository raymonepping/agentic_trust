<!-- app/components/AppHeader.vue -->
<template>
  <header class="w-full bg-gray-950 text-gray-100 border-b border-gray-800">
    <div class="container mx-auto flex items-center justify-between px-4 py-3">
      <NuxtLink to="/" class="flex items-baseline gap-2">
        <span class="text-sm font-medium text-gray-400">Agentic Trust</span>
        <span class="text-xs text-gray-500">Control plane</span>
      </NuxtLink>

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
    </div>
  </header>
</template>

<script setup lang="ts">
</script>
