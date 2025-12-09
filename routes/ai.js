import { Router } from "express";
import { answerQuestionAboutMission } from "../services/agent/missionAgent.js";

const router = Router();

router.post("/mission/:id", async (req, res, next) => {
  try {
    const missionId = req.params.id;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: "question is required" });
    }

    const result = await answerQuestionAboutMission({ missionId, question });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
