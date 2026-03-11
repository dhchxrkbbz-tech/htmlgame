import { Router } from "express";
import { isDatabaseConnected } from "../config/database.js";
import { loginUser, registerUser } from "../services/authService.js";

export const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

authRoutes.post("/login", async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

authRoutes.get("/health", (_req, res) => {
  res.json({
    ok: true,
    database: {
      connected: isDatabaseConnected(),
      mode: isDatabaseConnected() ? "mongodb" : "in-memory",
    },
  });
});