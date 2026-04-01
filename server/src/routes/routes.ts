import { Router } from "express";
import { getAggregatedStores } from "../services/store-aggregator.js";
import { planRoute } from "../services/route-planner.js";
import { sendRouteToDiscord } from "../bot.js";

const router = Router();

// GET /api/route — generate optimized route
router.get("/", (req, res) => {
  const minProfit = parseFloat(req.query.minProfit as string) || 5;
  const maxStops = parseInt(req.query.maxStops as string) || 8;
  const maxDistance = parseFloat(req.query.maxDistance as string) || 100;
  const storeIdsParam = req.query.storeIds as string | undefined;

  let stores = getAggregatedStores();

  if (storeIdsParam) {
    const ids = new Set(storeIdsParam.split(",").map(Number));
    stores = stores.filter((s) => ids.has(s.storeId));
    const route = planRoute(stores, { minProfitPerStore: 0, maxStops: stores.length, maxTotalDistance: 99999 });
    res.json(route);
    return;
  }

  const route = planRoute(stores, { minProfitPerStore: minProfit, maxStops, maxTotalDistance: maxDistance });
  res.json(route);
});

// POST /api/route/send — post current route to Discord
router.post("/send", async (req, res) => {
  const { storeIds } = req.body as { storeIds?: number[] };
  const sent = await sendRouteToDiscord(storeIds);
  if (sent) {
    res.json({ sent: true });
  } else {
    res.status(400).json({ sent: false, error: "Bot not connected or no stores to route" });
  }
});

export default router;
