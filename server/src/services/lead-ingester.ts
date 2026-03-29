import { getDb } from "../db/index.js";
import type { ParsedLead } from "./tempo-parser.js";

export function calcNetProfit(sellPrice: number, buyPrice: number): number {
  const feePct = parseFloat(process.env.SELL_FEE_PERCENT || "15") / 100;
  const feeFlat = parseFloat(process.env.SELL_FEE_FLAT || "5");
  return sellPrice * (1 - feePct) - feeFlat - buyPrice;
}

export function ingestLead(lead: ParsedLead): { productId: number; dealsInserted: number } {
  const db = getDb();

  const productStmt = db.prepare(`
    INSERT INTO products (name, msrp, sku, upc, product_url, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET msrp = excluded.msrp, product_url = excluded.product_url, image_url = excluded.image_url
  `);

  let productRow = lead.sku
    ? db.prepare("SELECT id FROM products WHERE sku = ?").get(lead.sku) as { id: number } | undefined
    : db.prepare("SELECT id FROM products WHERE name = ?").get(lead.productName) as { id: number } | undefined;

  if (!productRow) {
    const result = productStmt.run(lead.productName, lead.msrp, lead.sku, lead.upc, lead.productUrl, lead.imageUrl);
    productRow = { id: result.lastInsertRowid as number };
  }

  const productId = productRow.id;

  const storeStmt = db.prepare(`
    INSERT INTO stores (store_number, city, state, address, zip, distance_miles)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_number) DO UPDATE SET
      distance_miles = excluded.distance_miles
  `);

  const dealStmt = db.prepare(`
    INSERT INTO store_deals (store_id, product_id, store_price, floor_qty, backroom_qty, aisle, unit_profit, is_lowest_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_id, product_id) DO UPDATE SET
      store_price = excluded.store_price,
      floor_qty = excluded.floor_qty,
      backroom_qty = excluded.backroom_qty,
      aisle = excluded.aisle,
      unit_profit = excluded.unit_profit,
      is_lowest_price = excluded.is_lowest_price,
      created_at = datetime('now')
  `);

  let dealsInserted = 0;

  const transaction = db.transaction(() => {
    for (const store of lead.stores) {
      storeStmt.run(
        store.storeNumber,
        store.city,
        store.state,
        store.address,
        store.zip,
        store.distanceMiles
      );

      const storeRow = db.prepare("SELECT id FROM stores WHERE store_number = ?").get(store.storeNumber) as { id: number };

      const netProfit = calcNetProfit(lead.msrp, store.storePrice);
      dealStmt.run(
        storeRow.id,
        productId,
        store.storePrice,
        store.floorQty,
        store.backroomQty,
        store.aisle,
        netProfit,
        store.isLowestPrice ? 1 : 0
      );
      dealsInserted++;
    }
  });

  transaction();

  return { productId, dealsInserted };
}

// Recalculate all deal profits (called after MSRP edit or fee change)
export function recalcProfits(productId: number) {
  const db = getDb();
  const product = db.prepare("SELECT msrp FROM products WHERE id = ?").get(productId) as { msrp: number } | undefined;
  if (!product) return;

  const deals = db.prepare("SELECT id, store_price FROM store_deals WHERE product_id = ?").all(productId) as Array<{ id: number; store_price: number }>;
  const updateStmt = db.prepare("UPDATE store_deals SET unit_profit = ? WHERE id = ?");

  const transaction = db.transaction(() => {
    for (const deal of deals) {
      const netProfit = calcNetProfit(product.msrp, deal.store_price);
      updateStmt.run(netProfit, deal.id);
    }
  });

  transaction();
}
