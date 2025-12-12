// routes/debug.js
import { Router } from "express";
import { getAppSecrets } from "../services/vault/appSecrets.js";
import { encodeEmail } from "../services/vault/transformEmail.js";

const router = Router();

router.get("/app-secrets", async (req, res) => {
  try {
    const secrets = await getAppSecrets();
    res.json({
      ok: true,
      hasJwtSecret: !!secrets.jwtSecret,
      hasPasswordPepper: !!secrets.passwordPepper,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/transform-email", async (_req, res) => {
  try {
    const sample = "alice@example.com";
    const token = await encodeEmail(sample);
    res.json({
      ok: true,
      sample,
      tokenPreview: token.slice(0, 30) + "...",
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
