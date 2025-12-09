import { chat as aiChat } from "../ai/aiClient.js";
import { getMissionById } from "../missionService.js";

export async function answerQuestionAboutMission({ missionId, question }) {
  const mission = await getMissionById(missionId);
  if (!mission) {
    throw new Error(`Mission ${missionId} not found`);
  }

  const system =
    "You are an assistant that can only answer based on the provided mission context. " +
    "If you do not know, say you are unsure.";

  const contextLines = [
    `Title: ${mission.title}`,
    mission.owner ? `Owner: ${mission.owner}` : "",
    "",
    "Body:",
    mission.body,
  ].filter(Boolean);

  const context = contextLines.join("\n");

  const answer = await aiChat({
    system,
    messages: [
      {
        role: "user",
        content: `${context}\n\nUser question: ${question}`,
      },
    ],
  });

  return {
    missionId,
    question,
    answer,
  };
}
