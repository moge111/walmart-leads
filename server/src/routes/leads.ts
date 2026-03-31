import { Router } from "express";
import { getDb } from "../db/index.js";
import { parseTempoMessage } from "../services/tempo-parser.js";
import { ingestLead, recalcProfits } from "../services/lead-ingester.js";

const router = Router();

// GET /api/leads — list recent leads
router.get("/", (req, res) => {
  const db = getDb();
  const hours = parseInt(req.query.hours as string) || 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const leads = db.prepare(`
    SELECT p.*, COUNT(sd.id) as store_count,
           MIN(sd.store_price) as lowest_price
    FROM products p
    JOIN store_deals sd ON sd.product_id = p.id
    WHERE sd.created_at >= ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(cutoff);

  res.json(leads);
});

// GET /api/config — current fee config
router.get("/config", (_req, res) => {
  res.json({
    sellFeePercent: parseFloat(process.env.SELL_FEE_PERCENT || "15"),
    sellFeeFlat: parseFloat(process.env.SELL_FEE_FLAT || "5"),
    minProfitPerUnit: parseFloat(process.env.MIN_PROFIT_PER_UNIT || "5"),
  });
});

// POST /api/leads/parse — manually paste a Tempo message
router.post("/parse", (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400).json({ error: "message field required" });
    return;
  }

  const parsed = parseTempoMessage(message);
  if (!parsed) {
    res.status(400).json({ error: "Could not parse Tempo message" });
    return;
  }

  const result = ingestLead(parsed);
  res.json({
    product: parsed.productName,
    msrp: parsed.msrp,
    storesFound: parsed.stores.length,
    dealsInserted: result.dealsInserted,
  });
});

// PATCH /api/leads/products/:id/msrp — edit a product's sell price
router.patch("/products/:id/msrp", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { msrp } = req.body;
  if (msrp == null || isNaN(msrp)) {
    res.status(400).json({ error: "msrp required" });
    return;
  }
  db.prepare("UPDATE products SET msrp = ? WHERE id = ?").run(msrp, id);
  recalcProfits(parseInt(id));
  res.json({ updated: true, msrp });
});

// PATCH /api/deals/:id/exclude
router.patch("/deals/:id/exclude", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare("UPDATE store_deals SET excluded = 1 WHERE id = ?").run(id);
  res.json({ excluded: true });
});

// PATCH /api/deals/:id/include
router.patch("/deals/:id/include", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare("UPDATE store_deals SET excluded = 0 WHERE id = ?").run(id);
  res.json({ included: true });
});

// PATCH /api/leads/deals/:id/purchase
router.patch("/deals/:id/purchase", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { qty } = req.body;
  if (qty == null || isNaN(qty) || qty < 0) {
    res.status(400).json({ error: "qty required" });
    return;
  }
  db.prepare("UPDATE store_deals SET purchased = 1, purchased_qty = ? WHERE id = ?").run(qty, id);
  res.json({ purchased: true, qty });
});

// PATCH /api/leads/deals/:id/unpurchase
router.patch("/deals/:id/unpurchase", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  db.prepare("UPDATE store_deals SET purchased = 0, purchased_qty = 0 WHERE id = ?").run(id);
  res.json({ purchased: false });
});

// DELETE /api/leads — clear all leads
router.delete("/", (req, res) => {
  const db = getDb();
  db.exec("DELETE FROM store_deals");
  db.exec("DELETE FROM products");
  db.exec("DELETE FROM processed_messages");
  res.json({ cleared: true });
});

export default router;
