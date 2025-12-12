// controllers/authController.js
import crypto from "crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

import { getAppSecrets } from "../services/vault/appSecrets.js";
import { encodeEmail } from "../services/vault/transformEmail.js";
import {
  createUserRecord,
  findUserByEmailHash,
} from "../services/db/userRepository.js";

function computeEmailHash(email, pepper) {
  const normalized = String(email).trim().toLowerCase();
  const salt = pepper || "";
  return crypto
    .createHash("sha256")
    .update(normalized + salt, "utf8")
    .digest("hex");
}

async function issueJwtForUser(user) {
  const { jwtSecret } = await getAppSecrets();

  const payload = {
    sub: user.user_id,
    name: user.display_name,
    roles: user.roles || ["user"],
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
}

export async function register(req, res) {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
      return res
        .status(400)
        .json({ error: "email, password, display_name are required" });
    }

    const { passwordPepper } = await getAppSecrets();

    // 1) Tokenized email with Vault Transform for PII protection
    const email_token = await encodeEmail(email);

    // 2) Deterministic hash for lookup in Couchbase
    const email_hash = computeEmailHash(email, passwordPepper);

    // 3) Pepper + Argon2 for password hashing
    const passwordInput = passwordPepper
      ? `${password}${passwordPepper}`
      : password;

    const password_hash = await argon2.hash(passwordInput);

    const user = await createUserRecord({
      email_token,
      email_hash,
      display_name,
      password_hash,
    });

    const token = await issueJwtForUser(user);

    return res.status(201).json({
      token,
      user: {
        user_id: user.user_id,
        display_name: user.display_name,
        roles: user.roles,
      },
    });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ error: "registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }

    const { passwordPepper } = await getAppSecrets();

    // Same deterministic hash as in register
    const email_hash = computeEmailHash(email, passwordPepper);

    const user = await findUserByEmailHash(email_hash);
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const passwordInput = passwordPepper
      ? `${password}${passwordPepper}`
      : password;

    const ok = await argon2.verify(user.password_hash, passwordInput);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = await issueJwtForUser(user);

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        display_name: user.display_name,
        roles: user.roles,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "login failed" });
  }
}
