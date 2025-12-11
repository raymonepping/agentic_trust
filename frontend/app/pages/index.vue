<!-- app/pages/index.vue -->
<script setup lang="ts">
const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

// Keep track of last refresh time for the UI
const lastUpdated = ref<string | null>(null);

// Health, lease and diagnostics - all client side to avoid issues when prerendering
const {
  data: health,
  pending: healthPending,
  error: healthError,
  refresh: refreshHealth,
} = useAsyncData('health', () => $fetch(`${apiBase}/health`), {
  server: false,
});

const {
  data: lease,
  pending: leasePending,
  error: leaseError,
  refresh: refreshLease,
} = useAsyncData('lease', () => $fetch(`${apiBase}/db/lease`), {
  server: false,
});

const {
  data: diagnostics,
  pending: diagPending,
  error: diagError,
  refresh: refreshDiagnostics,
} = useAsyncData('diagnostics', () => $fetch(`${apiBase}/db/diagnostics`), {
  server: false,
});

// Overall loading state for the Refresh button
const refreshing = computed(
  () => healthPending.value || leasePending.value || diagPending.value,
);

async function refreshAll() {
  await Promise.all([
    refreshHealth(),
    refreshLease(),
    refreshDiagnostics(),
  ]);
  lastUpdated.value = new Date().toLocaleTimeString();
}

// Convenience computed values for the UI
const healthStatus = computed(() => {
  if (!health.value) return 'Unknown';
  return health.value.ok ? 'Healthy' : 'Degraded';
});

const healthColor = computed<'green' | 'red' | 'yellow'>(() => {
  if (!health.value) return 'yellow';
  return health.value.ok ? 'green' : 'red';
});

const couchbaseStatus = computed(() => {
  const cb = health.value?.couchbase;
  if (!cb) return 'Unknown';
  return cb.ok ? 'Connected' : 'Unavailable';
});

const couchbaseColor = computed<'green' | 'red' | 'yellow'>(() => {
  const cb = health.value?.couchbase;
  if (!cb) return 'yellow';
  return cb.ok ? 'green' : 'red';
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-950 text-gray-100">
    <!-- Optional global header from your components/ folder -->
    <AppHeader />

    <main class="flex-1">
      <UContainer class="py-8 space-y-6">
        <!-- Hero / summary -->
        <UCard class="card-strong">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 class="text-2xl font-semibold">
                Agentic Trust - Control Plane
              </h1>
              <p class="mt-1 text-sm text-gray-400">
                Live view of backend health, Vault driven Couchbase credentials and lease status.
              </p>
            </div>

            <div class="flex flex-col items-start gap-2 md:items-end">
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-400">Backend status</span>
                <UBadge :color="healthColor">
                  {{ healthStatus }}
                </UBadge>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-400">Couchbase</span>
                <UBadge :color="couchbaseColor">
                  {{ couchbaseStatus }}
                </UBadge>
              </div>

              <UButton
                size="sm"
                :loading="refreshing"
                variant="solid"
                icon="i-lucide-refresh-ccw"
                @click="refreshAll"
              >
                Refresh status
              </UButton>

              <p v-if="lastUpdated" class="text-xs text-gray-500">
                Last updated at {{ lastUpdated }}
              </p>
            </div>
          </div>

          <div v-if="healthError || leaseError || diagError" class="mt-4">
            <UAlert
              color="red"
              icon="i-lucide-alert-triangle"
              title="Some checks are failing"
              variant="subtle"
            >
              <p class="text-sm">
                Health: {{ healthError?.message || 'ok' }}<br>
                Lease: {{ leaseError?.message || 'ok' }}<br>
                Diagnostics: {{ diagError?.message || 'ok' }}
              </p>
            </UAlert>
          </div>
        </UCard>

        <!-- 3-column status grid -->
        <div class="grid gap-4 md:grid-cols-3">
          <!-- Health card -->
          <UCard class="card-strong">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-medium">Backend health</span>
                <UBadge :color="healthColor" variant="soft">
                  {{ healthStatus }}
                </UBadge>
              </div>
            </template>

            <div v-if="healthPending" class="text-sm text-gray-400">
              Checking backend health ...
            </div>

            <div v-else-if="health">
              <p class="text-sm text-gray-400">
                Service: <span class="font-mono text-gray-200">{{ health.service }}</span>
              </p>

              <div class="mt-3 space-y-1 text-sm">
                <p class="text-gray-400">
                  Bucket:
                  <span class="font-mono text-gray-200">
                    {{ health.couchbase?.bucket || 'missions' }}
                  </span>
                </p>
                <p class="text-gray-400">
                  Lease expires at:
                  <span class="font-mono text-gray-200">
                    {{ health.couchbase?.leaseExpiresAt || 'unknown' }}
                  </span>
                </p>
                <p class="text-gray-400">
                  Remaining:
                  <span class="font-mono text-gray-200">
                    {{ health.couchbase?.leaseHumanReadable || 'n/a' }}
                  </span>
                </p>
              </div>

              <div class="mt-4">
                <p class="text-xs uppercase tracking-wide text-gray-500">
                  Grace window
                </p>
                <p class="mt-1 text-xs text-gray-400">
                  Applied:
                  <span class="font-mono text-gray-200">
                    {{ health.grace?.applied ? 'yes' : 'no' }}
                  </span><br>
                  Seconds since last ok:
                  <span class="font-mono text-gray-200">
                    {{ health.grace?.secondsSinceLastOk ?? 'n/a' }}
                  </span>
                </p>
              </div>
            </div>
          </UCard>

          <!-- Lease card -->
          <UCard class="card-strong">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-medium">Lease</span>
                <UBadge color="purple" variant="soft">
                  Vault database role
                </UBadge>
              </div>
            </template>

            <div v-if="leasePending" class="text-sm text-gray-400">
              Fetching lease info ...
            </div>

            <div v-else-if="lease">
              <p class="text-sm text-gray-400">
                Expires at:
                <span class="font-mono text-gray-200">
                  {{ lease.expiresAt || 'unknown' }}
                </span>
              </p>
              <p class="mt-2 text-sm text-gray-400">
                Remaining:
                <span class="font-mono text-gray-200">
                  {{ lease.humanReadable || 'n/a' }}
                </span>
                <span class="text-xs text-gray-500">
                  ({{ lease.secondsRemaining ?? 'n/a' }} seconds)
                </span>
              </p>
            </div>
          </UCard>

          <!-- Diagnostics card -->
          <UCard class="card-strong">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-medium">Diagnostics</span>
                <UBadge :color="diagnostics?.ok ? 'green' : 'red'" variant="soft">
                  {{ diagnostics?.ok ? 'OK' : 'Error' }}
                </UBadge>
              </div>
            </template>

            <div v-if="diagPending" class="text-sm text-gray-400">
              Running diagnostics ...
            </div>

            <div v-else-if="diagnostics">
              <p class="text-sm text-gray-400">
                Bucket:
                <span class="font-mono text-gray-200">
                  {{ diagnostics.bucket || 'missions' }}
                </span>
              </p>
              <p class="mt-2 text-sm text-gray-400">
                Expires at:
                <span class="font-mono text-gray-200">
                  {{ diagnostics.expiresAt || 'unknown' }}
                </span>
              </p>
              <p class="mt-1 text-sm text-gray-400">
                Remaining:
                <span class="font-mono text-gray-200">
                  {{ diagnostics.humanReadable || 'n/a' }}
                </span>
              </p>
            </div>
          </UCard>
        </div>

        <!-- Placeholder for the next step: missions + agent -->
        <UCard class="card-strong">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-lg font-medium">
                Missions and Agentic Q&A
              </h2>
              <p class="mt-1 text-sm text-gray-400">
                Next step - surface missions from Couchbase and wire Ollama Q&A against the backend.
              </p>
            </div>
            <UButton
              variant="outline"
              icon="i-lucide-arrow-right"
              color="gray"
            >
              Coming up in the next iteration
            </UButton>
          </div>
        </UCard>
      </UContainer>
    </main>

    <!-- Optional global footer -->
    <AppFooter />
  </div>
</template>
