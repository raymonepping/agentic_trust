<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useApiClient } from '../composables/useApiClient'

const { get } = useApiClient()

type AuditInitiator = {
  user_id: string | null
  user_name: string | null
  mission_id: string | null
}

type ParsedAuditEntry = {
  id: string
  raw: string
  parsed: {
    time: string | null
    type: string | null
    path: string | null
    operation: string | null
    display_name: string | null
    role_name: string | null
    remote_address: string | null
    token_policies: string[] | null
    initiator?: AuditInitiator | null
  } | null
}

type ViewEntry = {
  id: string
  isRequest: boolean
  operation: string
  engine: string
  endpoint: string
  path: string
  who: string
  shortPolicies: string
  remoteAddress?: string | null
  remotePort?: number | string | null
  ts: string
  allowed: boolean | null
  rawObj: Record<string, any>
  leaseId?: string | null
  leaseShort?: string | null
  initiator?: AuditInitiator | null
}

const entries = ref<ParsedAuditEntry[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const logPath = ref<string | null>(null)
const totalLines = ref<number | null>(null)
const returned = ref<number | null>(null)

const lines = ref(10)
const hasEntries = computed(() => entries.value.length > 0)

async function fetchAuditTail() {
  loading.value = true
  error.value = null

  try {
    const data = await get<{
      path: string
      totalLines: number
      returned: number
      entries: ParsedAuditEntry[]
    }>('/audit/tail', {
      query: { lines: lines.value }
    })

    logPath.value = data.path
    totalLines.value = data.totalLines
    returned.value = data.returned
    entries.value = data.entries
  } catch (err: any) {
    error.value = err?.message || 'Failed to load audit log'
  } finally {
    loading.value = false
  }
}

function changeLines(value: number) {
  if (lines.value === value) return
  lines.value = value
  fetchAuditTail()
}

// derive a richer view model from the returned entries
const viewEntries = computed<ViewEntry[]>(() =>
  entries.value.map((e) => {
    let rawObj: any = {}
    try {
      rawObj = JSON.parse(e.raw)
    } catch {
      rawObj = {}
    }

    const isRequest = rawObj.type === 'request'
    const op
      = rawObj.request?.operation
        || rawObj.response?.operation
        || e.parsed?.operation
        || 'unknown'

    const fullPath
      = rawObj.request?.path
        || rawObj.response?.path
        || e.parsed?.path
        || ''

    const [engine, ...rest] = fullPath.split('/')
    const endpoint = rest.join('/')

    const displayName
      = rawObj.auth?.display_name || e.parsed?.display_name || 'unknown'
    const roleName
      = rawObj.auth?.metadata?.role_name || e.parsed?.role_name || null
    const who = roleName ? `${displayName} (${roleName})` : displayName

    const policies: string[]
      = rawObj.auth?.policies || e.parsed?.token_policies || []

    const shortPolicies
      = policies.length > 2
        ? `${policies.slice(0, 2).join(', ')} +${policies.length - 2} more`
        : policies.join(', ')

    const allowed = rawObj.auth?.policy_results?.allowed ?? null

    const leaseId: string | null
      = rawObj.response?.secret?.lease_id || null
    const leaseShort = leaseId ? leaseId.split('/').slice(-1)[0] : null

    const id
      = rawObj.request?.id
        || rawObj.response?.request?.id
        || e.id
        || `${rawObj.time || ''}-${rawObj.type || ''}`

    // New: initiator derived from metadata or parsed payload
    const meta = rawObj.auth?.metadata || e.parsed?.initiator || null
    const initiator: AuditInitiator | null =
      meta && (meta.user_id || meta.user_name || meta.mission_id)
        ? {
            user_id: meta.user_id ?? null,
            user_name: meta.user_name ?? null,
            mission_id: meta.mission_id ?? null
          }
        : null

    return {
      id,
      isRequest,
      operation: op,
      engine: engine || 'unknown',
      endpoint,
      path: fullPath || 'unknown',
      who,
      shortPolicies,
      remoteAddress:
        rawObj.request?.remote_address || e.parsed?.remote_address || null,
      remotePort: rawObj.request?.remote_port ?? null,
      ts: rawObj.time || e.parsed?.time || '',
      allowed,
      rawObj,
      leaseId,
      leaseShort,
      initiator
    }
  })
)

const entriesLabel = computed(() =>
  viewEntries.value.length === 1
    ? '1 entry'
    : `${viewEntries.value.length} entries`
)

onMounted(() => {
  fetchAuditTail()
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <AppHeader />

    <UContainer class="py-8 space-y-6">
      <!-- Hero -->
      <UCard class="card-strong">
        <div
          class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h1 class="text-2xl font-semibold">
              Vault audit tail
            </h1>
            <p class="mt-1 text-sm text-gray-400">
              Viewing the latest entries from the Vault audit log as JSON
              records.
            </p>
          </div>

          <div class="flex flex-col items-start gap-2 md:items-end">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">
                Lines:
              </span>
              <div class="inline-flex gap-1">
                <UButton
                  size="xs"
                  variant="ghost"
                  :color="lines === 5 ? 'primary' : 'gray'"
                  @click="changeLines(5)"
                >
                  5
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  :color="lines === 10 ? 'primary' : 'gray'"
                  @click="changeLines(10)"
                >
                  10
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  :color="lines === 25 ? 'primary' : 'gray'"
                  @click="changeLines(25)"
                >
                  25
                </UButton>
              </div>
            </div>

            <UButton
              size="sm"
              variant="solid"
              icon="i-lucide-refresh-ccw"
              :loading="loading"
              @click="fetchAuditTail"
            >
              Refresh
            </UButton>

            <p
              v-if="totalLines != null && returned != null"
              class="text-xs text-gray-500"
            >
              Showing last {{ returned }} of {{ totalLines }} line(s)
            </p>
          </div>
        </div>

        <div class="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <span class="font-mono">Path:</span>
          <span class="truncate max-w-full font-mono">
            {{ logPath || "unknown" }}
          </span>
        </div>

        <div
          v-if="error"
          class="mt-4"
        >
          <UAlert
            color="red"
            icon="i-lucide-alert-triangle"
            title="Could not read audit log"
            variant="subtle"
          >
            <p class="text-sm">
              {{ error }}
            </p>
          </UAlert>
        </div>
      </UCard>

      <!-- Entries -->
      <UCard class="card-strong">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">
              Latest audit entries
            </span>
            <UBadge
              v-if="viewEntries.length"
              color="green"
              variant="soft"
            >
              {{ entriesLabel }}
            </UBadge>
            <UBadge
              v-else
              color="gray"
              variant="soft"
            >
              No entries
            </UBadge>
          </div>
        </template>

        <div
          v-if="loading"
          class="space-y-2"
        >
          <USkeleton class="h-6 w-full" />
          <USkeleton class="h-6 w-5/6" />
          <USkeleton class="h-6 w-4/6" />
        </div>

        <div
          v-else-if="!viewEntries.length"
          class="text-sm text-gray-500"
        >
          No audit entries found in the current log tail.
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <div
            v-for="entry in viewEntries"
            :key="entry.id"
            class="rounded-lg bg-gray-950/70 px-3 py-2 text-xs border"
            :class="entry.allowed === false
              ? 'border-red-700/70'
              : entry.allowed === true
                ? 'border-emerald-700/70'
                : 'border-gray-800'"
          >
            <!-- Top row -->
            <div
              class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex flex-wrap items-center gap-2">
                <UBadge
                  size="xs"
                  :color="entry.isRequest ? 'blue' : 'emerald'"
                  variant="soft"
                  class="uppercase tracking-wide"
                >
                  {{ entry.isRequest ? "request" : "response" }}
                </UBadge>

                <span class="font-mono text-gray-200">
                  {{ entry.operation }} {{ entry.endpoint || entry.path }}
                </span>
              </div>

              <div
                class="flex flex-wrap items-center gap-2 text-[11px] text-gray-500"
              >
                <span class="capitalize">
                  {{ entry.engine }}
                </span>
                <span v-if="entry.remoteAddress">•</span>
                <span v-if="entry.remoteAddress">
                  {{ entry.remoteAddress }}<span v-if="entry.remotePort">
                    : {{ entry.remotePort }}</span>
                </span>
                <span v-if="entry.ts">•</span>
                <span v-if="entry.ts">
                  {{ entry.ts }}
                </span>
              </div>
            </div>

            <!-- Second row -->
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="text-[11px] text-gray-400">
                {{ entry.who }}
              </span>

              <UBadge
                v-if="entry.allowed !== null"
                size="xs"
                :color="entry.allowed ? 'green' : 'red'"
                variant="soft"
              >
                {{ entry.allowed ? "allowed" : "denied" }}
              </UBadge>

              <span
                v-if="entry.shortPolicies"
                class="text-[10px] text-gray-500"
              >
                {{ entry.shortPolicies }}
              </span>

              <span
                v-if="entry.leaseShort"
                class="text-[10px] text-emerald-400/90 font-mono"
                :title="entry.leaseId || ''"
              >
                lease: {{ entry.leaseShort }}
              </span>
            </div>

            <!-- Initiator line, only when metadata is present -->
            <div
              v-if="entry.initiator"
              class="mt-1 text-[11px] text-emerald-400"
            >
              Initiator:
              <span class="font-mono">
                {{ entry.initiator.user_name || entry.initiator.user_id || 'unknown' }}
              </span>
              <span
                v-if="entry.initiator.mission_id"
                class="text-emerald-300"
              >
                · mission {{ entry.initiator.mission_id }}
              </span>
            </div>

            <!-- Raw JSON -->
            <details class="mt-2 text-[11px] text-gray-400">
              <summary
                class="cursor-pointer text-gray-500 hover:text-gray-300"
              >
                Raw JSON
              </summary>
              <pre
                class="mt-2 max-h-64 overflow-auto rounded-md bg-black/40 p-2 font-mono text-[10px] text-gray-200"
              >
{{ JSON.stringify(entry.rawObj, null, 2) }}
              </pre>
            </details>
          </div>
        </div>
      </UCard>
    </UContainer>

    <AppFooter />
  </div>
</template>
