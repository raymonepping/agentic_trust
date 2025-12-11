<script setup lang="ts">
import { useMissions } from '../composables/useMissions'

const {
  missions,
  missionsLoading,
  missionsError,
  fetchMissions,
  selectedMission,
  missionLoading,
  missionError,
  selectMission,
  messages,
  sending,
  qaError,
  userQuestion,
  askQuestion,
  creating,
  createError,
  createMission
} = useMissions()

// simple local form state
const newTitle = ref('')
const newOwner = ref('')
const newTags = ref('')
const newBody = ref('')

// pagination state
const pageSize = 5
const currentPage = ref(1)

const hasSelection = computed(() => Boolean(selectedMission.value))

const totalPages = computed(() =>
  Math.max(1, Math.ceil(missions.value.length / pageSize))
)

const paginatedMissions = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return missions.value.slice(start, start + pageSize)
})

// maps backend summary_status to a label
function summaryStatusLabel(status?: string | null) {
  if (status === 'complete') return 'complete'
  if (status === 'error') return 'error'
  return 'n/a'
}

// maps backend summary_status to a badge color
function summaryStatusColor(status?: string | null) {
  if (status === 'complete') return 'green'
  if (status === 'error') return 'red'
  return 'gray'
}

// keep currentPage valid when missions change
watch(missions, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

function goPrevPage() {
  if (currentPage.value > 1) currentPage.value -= 1
}

function goNextPage() {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

async function handleCreateMission() {
  if (!newTitle.value.trim() || !newBody.value.trim()) {
    return
  }

  const tags = newTags.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  await createMission({
    title: newTitle.value.trim(),
    body: newBody.value.trim(),
    owner: newOwner.value.trim() || undefined,
    tags
  })

  // show newest missions (list is ordered DESC by created_at)
  currentPage.value = 1

  // clear form after successful create
  newTitle.value = ''
  newOwner.value = ''
  newTags.value = ''
  newBody.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <AppHeader />
    <UContainer class="py-8 space-y-6">
      <!-- Hero -->
      <UCard class="card-strong">
        <div
          class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <h1 class="text-2xl font-semibold">
              Missions and Agentic Q&A
            </h1>
            <p class="mt-1 text-sm text-gray-400">
              Browse missions from Couchbase and let the Ollama backed agent answer questions in context.
            </p>
          </div>

          <div class="flex flex-col items-start gap-2 md:items-end">
            <UButton
              size="sm"
              variant="solid"
              icon="i-lucide-refresh-ccw"
              :loading="missionsLoading"
              @click="fetchMissions"
            >
              Reload missions
            </UButton>
            <p class="text-xs text-gray-500">
              {{ missions.length }} mission(s) loaded from Couchbase
            </p>
          </div>
        </div>

        <div
          v-if="missionsError"
          class="mt-4"
        >
          <UAlert
            color="red"
            icon="i-lucide-alert-triangle"
            title="Could not load missions"
            variant="subtle"
          >
            <p class="text-sm">
              {{ missionsError }}
            </p>
          </UAlert>
        </div>
      </UCard>

      <!-- Main grid: list + detail + chat -->
      <div class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <!-- Missions list and create form -->
        <UCard class="card-strong">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">Missions</span>
              <UBadge
                color="gray"
                variant="soft"
              >
                Couchbase
              </UBadge>
            </div>
          </template>

          <!-- Create mission form -->
          <div class="mb-4 space-y-3 border-b border-gray-800 pb-4">
            <h2 class="text-sm font-semibold text-gray-200">
              Create a new mission
            </h2>

            <div class="grid gap-3 sm:grid-cols-2">
              <UFormField
                name="title"
                label="Title"
              >
                <UInput
                  v-model="newTitle"
                  placeholder="Short mission title"
                />
              </UFormField>

              <UFormField
                name="owner"
                label="Owner"
                help="Optional"
              >
                <UInput
                  v-model="newOwner"
                  placeholder="Owner or responsible person"
                />
              </UFormField>
            </div>

            <UFormField
              name="tags"
              label="Tags"
              help="Comma separated, for example: rotation, vault, couchbase"
            >
              <UInput
                v-model="newTags"
                placeholder="rotation, vault, couchbase"
              />
            </UFormField>

            <UFormField
              name="body"
              label="Body"
              help="Stored encrypted in Couchbase using Vault Transit."
            >
              <UTextarea
                v-model="newBody"
                :rows="3"
                placeholder="Describe the mission, goals and key risks."
              />
            </UFormField>

            <div class="flex items-center justify-between gap-3">
              <p class="text-xs text-gray-500">
                Content is encrypted by the backend before it is stored in Couchbase.
              </p>

              <UButton
                size="sm"
                icon="i-lucide-plus"
                :loading="creating"
                :disabled="!newTitle.trim() || !newBody.trim()"
                @click="handleCreateMission"
              >
                Create mission
              </UButton>
            </div>

            <div
              v-if="createError"
              class="mt-2"
            >
              <UAlert
                color="red"
                icon="i-lucide-alert-triangle"
                variant="subtle"
                title="Could not create mission"
              >
                <p class="text-xs">
                  {{ createError }}
                </p>
              </UAlert>
            </div>
          </div>

          <!-- Existing list -->
          <div
            v-if="missionsLoading"
            class="space-y-2"
          >
            <USkeleton class="h-7 w-full" />
            <USkeleton class="h-7 w-5/6" />
            <USkeleton class="h-7 w-4/6" />
          </div>

          <div
            v-else-if="missions.length === 0"
            class="text-sm text-gray-400"
          >
            No missions found yet. Create one above or seed Couchbase then reload.
          </div>

          <div v-else>
            <ul class="divide-y divide-gray-800">
              <li
                v-for="mission in paginatedMissions"
                :key="mission.id"
              >
                <button
                  type="button"
                  class="w-full text-left px-3 py-3 hover:bg-gray-900 transition flex items-start justify-between gap-3"
                  :class="selectedMission?.id === mission.id ? 'bg-gray-900/80' : ''"
                  @click="selectMission(mission)"
                >
                  <div>
                    <p class="text-sm font-medium text-gray-100">
                      {{ mission.title || mission.id }}
                    </p>
                    <p class="mt-1 text-xs text-gray-400 line-clamp-2">
                      {{ mission.summary || 'No summary available for this mission yet.' }}
                    </p>
                  </div>

                  <div class="flex flex-col items-end gap-1">
                    <UBadge
                      size="xs"
                      :color="summaryStatusColor(mission.summary_status)"
                      variant="soft"
                    >
                      Summary: {{ summaryStatusLabel(mission.summary_status) }}
                    </UBadge>

                    <span
                      v-if="mission.created_at"
                      class="text-[11px] text-gray-500"
                    >
                      {{ mission.created_at }}
                    </span>
                  </div>
                </button>
              </li>
            </ul>

            <!-- Pager -->
            <div
              v-if="missions.length > pageSize"
              class="flex items-center justify-between px-3 py-2 text-xs text-gray-400"
            >
              <span>
                Showing
                {{ (currentPage - 1) * pageSize + 1 }}
                –
                {{ Math.min(currentPage * pageSize, missions.length) }}
                of {{ missions.length }} missions
              </span>

              <div class="flex gap-2">
                <UButton
                  size="2xs"
                  variant="ghost"
                  icon="i-lucide-chevron-left"
                  :disabled="currentPage === 1"
                  @click="goPrevPage"
                >
                  Previous
                </UButton>
                <UButton
                  size="2xs"
                  variant="ghost"
                  icon-right="i-lucide-chevron-right"
                  :disabled="currentPage === totalPages"
                  @click="goNextPage"
                >
                  Next
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Detail + Q&A -->
        <UCard class="card-strong min-h-[420px] flex flex-col">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex flex-col">
                <span class="font-medium">
                  Mission detail and Q&A
                </span>
                <span class="text-xs text-gray-400">
                  Answers are generated by the backend agent that talks to Ollama.
                </span>
              </div>

              <UBadge
                v-if="hasSelection"
                color="green"
                variant="soft"
              >
                Mission selected
              </UBadge>
              <UBadge
                v-else
                color="gray"
                variant="soft"
              >
                Select a mission
              </UBadge>
            </div>
          </template>

          <div class="flex-1 flex flex-col gap-4 overflow-hidden">
            <!-- Detail area -->
            <div class="border border-gray-800 rounded-lg p-3 bg-gray-950/60">
              <div v-if="missionLoading">
                <USkeleton class="h-4 w-1/2 mb-2" />
                <USkeleton class="h-4 w-4/5 mb-1" />
                <USkeleton class="h-4 w-3/5" />
              </div>

              <div
                v-else-if="selectedMission"
                class="space-y-2 text-sm"
              >
                <p class="font-semibold text-gray-100">
                  {{ selectedMission.title || selectedMission.id }}
                </p>
                <p class="text-gray-400">
                  {{ selectedMission.summary || "No summary stored for this mission yet." }}
                </p>

                <div class="grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                  <div class="flex items-center gap-1">
                    <span class="text-gray-500">Summary:</span>
                    <UBadge
                      size="xs"
                      :color="summaryStatusColor(selectedMission.summary_status)"
                      variant="soft"
                    >
                      {{ summaryStatusLabel(selectedMission.summary_status) }}
                    </UBadge>
                  </div>

                  <div v-if="selectedMission.created_at">
                    <span class="text-gray-500">Created:</span>
                    <span class="ml-1 font-mono text-gray-200">
                      {{ selectedMission.created_at }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="text-sm text-gray-400"
              >
                Select a mission from the list to see details and start asking questions.
              </div>

              <div
                v-if="missionError"
                class="mt-2"
              >
                <UAlert
                  color="red"
                  icon="i-lucide-alert-triangle"
                  variant="subtle"
                  title="Could not load mission details"
                >
                  <p class="text-xs">
                    {{ missionError }}
                  </p>
                </UAlert>
              </div>
            </div>

            <!-- Chat area -->
            <div class="flex-1 flex flex-col gap-3 overflow-hidden">
              <div class="flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/60 p-3 space-y-3">
                <p
                  v-if="messages.length === 0"
                  class="text-sm text-gray-500"
                >
                  Ask a question about the selected mission. The backend will fetch context from Couchbase and call Ollama.
                </p>

                <div
                  v-for="(msg, idx) in messages"
                  :key="idx"
                  class="flex"
                  :class="msg.from === 'user' ? 'justify-end' : 'justify-start'"
                >
                  <div
                    class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                    :class="msg.from === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-800 text-gray-100'"
                  >
                    <p class="whitespace-pre-wrap">
                      {{ msg.text }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <UFormField
                  name="question"
                  label="Ask the agent"
                  :help="hasSelection
                    ? 'Questions are scoped to the selected mission.'
                    : 'Select a mission first.'"
                >
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <UTextarea
                      v-model="userQuestion"
                      :rows="2"
                      :disabled="!hasSelection || sending"
                      placeholder="For example: What is the main goal of this mission, and what are the key risks?"
                    />
                    <UButton
                      class="sm:self-end sm:w-auto w-full"
                      :disabled="!hasSelection || !userQuestion.trim()"
                      :loading="sending"
                      icon="i-lucide-arrow-right"
                      @click="askQuestion"
                    >
                      Ask
                    </UButton>
                  </div>
                </UFormField>

                <div
                  v-if="qaError"
                  class="mt-2"
                >
                  <UAlert
                    color="red"
                    icon="i-lucide-alert-triangle"
                    variant="subtle"
                    title="Agent request failed"
                  >
                    <p class="text-xs">
                      {{ qaError }}
                    </p>
                  </UAlert>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
    <AppFooter />
  </div>
</template>
