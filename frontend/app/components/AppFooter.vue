<!-- app/components/AppFooter.vue -->
<template>
  <footer class="w-full bg-gray-950 text-gray-100 border-t border-gray-800">
    <div
      class="container mx-auto px-4 py-4 flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between"
    >
      <div class="flex flex-col gap-1">
        <span class="font-semibold">
          Agentic Trust
        </span>
        <span class="text-gray-400 text-xs">
          Local control plane for Vault driven Couchbase credentials and health.
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <NuxtLink
          to="/"
          class="hover:text-primary-400 transition-colors"
        >
          Dashboard
        </NuxtLink>
        <a
          href="http://localhost:3001/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-primary-400 transition-colors"
        >
          API docs
        </a>
        <a
          href="http://localhost:3001/health"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-primary-400 transition-colors"
        >
          Health endpoint
        </a>
      </div>
    </div>

    <div class="bg-gray-900 border-t border-gray-800">
      <div
        class="container mx-auto px-4 py-2 text-xs flex flex-col gap-1 items-start justify-between sm:flex-row sm:items-center"
      >
        <span class="text-gray-500">
          © {{ year }} Agentic Trust control plane
        </span>

        <span class="text-gray-500">
          Powered by
          <a
            href="https://developer.hashicorp.com/vault"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary-400 hover:underline transition-colors"
          >
            Vault
          </a>
          <span class="mx-1">•</span>
          <a
            href="https://www.couchbase.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary-400 hover:underline transition-colors"
          >
            Couchbase
          </a>
          <span class="mx-1">•</span>
          <a
            href="https://nuxt.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary-400 hover:underline transition-colors"
          >
            Nuxt
          </a>
          <span class="mx-1">•</span>
          <a
            href="https://ollama.com/"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-primary-400 hover:underline transition-colors"
          >
            Ollama
          </a>
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>
