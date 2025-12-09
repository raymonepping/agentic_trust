import { Router } from "express";
import {
  createMission,
  listMissions,
  getMissionById,
} from "../services/missionService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { title, body, owner, tags } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const mission = await createMission({ title, body, owner, tags });
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
