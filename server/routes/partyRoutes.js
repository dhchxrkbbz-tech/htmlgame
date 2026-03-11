import { Router } from "express";
import { acceptPartyInvite, createParty, getPartyState, inviteToParty, listParties, syncPartyState } from "../services/partyService.js";

export const partyRoutes = Router();

partyRoutes.get("/", async (_req, res) => {
  res.json(await listParties());
});

partyRoutes.get("/:partyId", async (req, res) => {
  const party = await getPartyState(req.params.partyId);
  if (!party) {
    res.status(404).json({ error: "Party not found." });
    return;
  }

  res.json(party);
});

partyRoutes.post("/", async (req, res) => {
  try {
    const party = await createParty(req.body);
    res.status(201).json(party);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

partyRoutes.post("/sync", async (req, res) => {
  try {
    const party = await syncPartyState(req.body);
    res.status(200).json(party);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

partyRoutes.post("/invite", async (req, res) => {
  try {
    const party = await inviteToParty(req.body.partyId, req.body.invitedBy, req.body.username);
    res.status(200).json(party);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

partyRoutes.post("/accept", async (req, res) => {
  try {
    const party = await acceptPartyInvite(req.body.partyId, req.body.username);
    res.status(200).json(party);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});