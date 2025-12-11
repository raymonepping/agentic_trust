// routes/mission.js
import { Router } from "express";
import logger from "../configurations/logger.js";

import {
  createMission,
  listMissions,
  getMissionById,
} from "../services/missionService.js";
import { generateMissionSummary } from "../services/ai/providers/summaryProvider.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { title, body, owner, tags } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    // Enrichment step: try to generate a summary from the plaintext body
    let summary = "";
    let summaryStatus = "n/a";

    try {
      summary = await generateMissionSummary(body);
      summaryStatus = summary ? "complete" : "error";

      logger.info(
        `[missions] Summary generation for new mission: status=${summaryStatus}`
      );
    } catch (err) {
      summary = "";
      summaryStatus = "error";
      logger.warn(
        `[missions] Failed to generate summary: ${err.message}`
      );
    }

    // Pass summary + status into the service
    const mission = await createMission({
      title,
      body,
      owner,
      tags,
      summary,
      summaryStatus,
    });

    res.status(201).json(mission);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const missions = await listMissions();
    res.json(missions);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const mission = await getMissionById(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(mission);
  } catch (err) {
    next(err);
  }
});

export default router;
