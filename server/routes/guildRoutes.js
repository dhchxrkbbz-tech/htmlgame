import { Router } from "express";
import { addGuildMessage, createGuild, getGuildState, joinGuild, listGuilds } from "../services/guildService.js";

export const guildRoutes = Router();

guildRoutes.get("/", async (_req, res) => {
  res.json(await listGuilds());
});

guildRoutes.get("/:guildId", async (req, res) => {
  const guild = await getGuildState(req.params.guildId);
  if (!guild) {
    res.status(404).json({ error: "Guild not found." });
    return;
  }

  res.json(guild);
});

guildRoutes.post("/", async (req, res) => {
  try {
    const guild = await createGuild(req.body);
    res.status(201).json(guild);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

guildRoutes.post("/join", async (req, res) => {
  try {
    const guild = await joinGuild(req.body.guildId, req.body.username);
    res.status(200).json(guild);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

guildRoutes.post("/chat", async (req, res) => {
  try {
    const entry = await addGuildMessage(req.body);
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});