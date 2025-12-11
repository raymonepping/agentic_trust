import { useApiClient } from "./useApiClient";

type Mission = {
  id: string;
  title?: string;
  summary?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type QaMessage = {
  from: "user" | "ai";
  text: string;
  ts: string;
};

export function useMissions() {
  const { get, post } = useApiClient();

  const missions = ref<Mission[]>([]);
  const missionsLoading = ref(false);
  const missionsError = ref<string | null>(null);

  const selectedMission = ref<Mission | null>(null);
  const missionLoading = ref(false);
  const missionError = ref<string | null>(null);

  const messages = ref<QaMessage[]>([]);
  const sending = ref(false);
  const qaError = ref<string | null>(null);
  const userQuestion = ref("");

  // new: creation state
  const creating = ref(false);
  const createError = ref<string | null>(null);

  async function fetchMissions() {
    missionsLoading.value = true;
    missionsError.value = null;

    try {
      const data = await get<Mission[]>("/missions");
      missions.value = data;
    } catch (err: any) {
      missionsError.value = err?.message || "Failed to load missions";
    } finally {
      missionsLoading.value = false;
    }
  }

  async function selectMission(mission: Mission) {
    selectedMission.value = null;
    missionError.value = null;
    missionLoading.value = true;
    messages.value = [];
    qaError.value = null;
    userQuestion.value = "";

    try {
      const data = await get<Mission>(`/missions/${mission.id}`);
      selectedMission.value = data;
    } catch (err: any) {
      missionError.value = err?.message || "Failed to load mission details";
    } finally {
      missionLoading.value = false;
    }
  }

  // new: create a mission through POST /missions
  async function createMission(payload: {
    title: string;
    body: string;
    owner?: string;
    tags?: string[];
  }) {
    creating.value = true;
    createError.value = null;

    try {
      const created = await post<Mission>("/missions", payload);

      // Prepend new mission to the list
      missions.value = [created, ...missions.value];

      // Select it so the detail panel shows the new mission
      selectedMission.value = created;

      return created;
    } catch (err: any) {
      createError.value = err?.message || "Failed to create mission";
      throw err;
    } finally {
      creating.value = false;
    }
  }

  async function askQuestion() {
    if (!selectedMission.value || !userQuestion.value.trim()) {
      return;
    }

    const q = userQuestion.value.trim();
    userQuestion.value = "";
    qaError.value = null;

    const questionMsg: QaMessage = {
      from: "user",
      text: q,
      ts: new Date().toISOString(),
    };
    messages.value.push(questionMsg);

    sending.value = true;

    try {
      const res = await post<{ answer: string }>(
        `/ai/mission/${selectedMission.value.id}`,
        { question: q },
      );

      const answerText = res?.answer ?? "(No answer returned)";

      const answerMsg: QaMessage = {
        from: "ai",
        text: answerText,
        ts: new Date().toISOString(),
      };
      messages.value.push(answerMsg);
    } catch (err: any) {
      qaError.value = err?.message || "AI request failed";
    } finally {
      sending.value = false;
    }
  }

  onMounted(() => {
    fetchMissions();
  });

  return {
    // list
    missions,
    missionsLoading,
    missionsError,
    fetchMissions,

    // selection
    selectedMission,
    missionLoading,
    missionError,
    selectMission,

    // creation
    creating,
    createError,
    createMission,

    // Q&A
    messages,
    sending,
    qaError,
    userQuestion,
    askQuestion,
  };
}
