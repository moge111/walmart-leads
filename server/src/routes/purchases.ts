import { Router } from "express";
import { getPurchases } from "../services/store-aggregator.js";

const router = Router();

// GET /api/purchases
router.get("/", (_req, res) => {
  res.json(getPurchases());
});

export default router;
