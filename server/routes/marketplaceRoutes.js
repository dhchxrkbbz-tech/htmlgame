import { Router } from "express";
import { cancelListing, createMarketListing, finalizeListingPurchase, getListingAudit, listMarketListings, releaseReservedListing, reserveListing } from "../services/marketplaceService.js";

export const marketplaceRoutes = Router();

marketplaceRoutes.get("/listings", async (_req, res) => {
  res.json(await listMarketListings());
});

marketplaceRoutes.post("/listings", async (req, res) => {
  try {
    const listing = await createMarketListing(req.body);
    res.status(201).json(listing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

marketplaceRoutes.post("/reserve", async (req, res) => {
  try {
    const listing = await reserveListing(req.body.listingId, req.body.buyer);
    res.status(200).json(listing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

marketplaceRoutes.post("/buy", async (req, res) => {
  try {
    const purchase = await finalizeListingPurchase(req.body.listingId, req.body.buyer);
    res.status(200).json(purchase);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

marketplaceRoutes.post("/release", async (req, res) => {
  try {
    const listing = await releaseReservedListing(req.body.listingId, req.body.buyer, req.body.reason);
    res.status(200).json(listing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

marketplaceRoutes.post("/cancel", async (req, res) => {
  try {
    const cancelled = await cancelListing(req.body.listingId, req.body.seller);
    res.status(200).json(cancelled);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

marketplaceRoutes.get("/audit/:listingId", async (req, res) => {
  try {
    const auditLog = await getListingAudit(req.params.listingId);
    res.status(200).json(auditLog);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});