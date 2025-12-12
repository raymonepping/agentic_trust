// middleware/requireUser.js
import jwt from "jsonwebtoken";
import { getAppSecrets } from "../services/vault/appSecrets.js";

export async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ error: "missing or invalid Authorization header" });
    }

    const { jwtSecret } = await getAppSecrets();
    const decoded = jwt.verify(token, jwtSecret);

    req.user = {
      user_id: decoded.sub,
      display_name: decoded.name,
      roles: decoded.roles || [],
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}
