import { Router } from "express";
import { getAggregatedStores } from "../services/store-aggregator.js";

const router = Router();

// GET /api/stores — aggregated store data
router.get("/", (req, res) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const stores = getAggregatedStores(hours);
  res.json(stores);
});

export default router;
