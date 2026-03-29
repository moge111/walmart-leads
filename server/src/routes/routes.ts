import { Router } from "express";
import { getAggregatedStores } from "../services/store-aggregator.js";
import { planRoute } from "../services/route-planner.js";

const router = Router();

// GET /api/route — generate optimized route
router.get("/", (req, res) => {
  const hours = parseInt(req.query.hours as string) || 24;
  const minProfit = parseFloat(req.query.minProfit as string) || 5;
  const maxStops = parseInt(req.query.maxStops as string) || 8;
  const maxDistance = parseFloat(req.query.maxDistance as string) || 100;

  const stores = getAggregatedStores(hours);
  const route = planRoute(stores, {
    minProfitPerStore: minProfit,
    maxStops,
    maxTotalDistance: maxDistance,
  });

  res.json(route);
});

export default router;
