import { getDb } from "../db/index.js";

export interface AggregatedStore {
  storeId: number;
  storeNumber: number;
  city: string;
  state: string;
  address: string;
  zip: string;
  distanceMiles: number;
  dealCount: number;
  totalProfit: number;
  totalQty: number;
  score: number;
  deals: StoreDeal[];
}

export interface StoreDeal {
  dealId: number;
  productId: number;
  productName: string;
  productUrl: string | null;
  msrp: number;
  storePrice: number;
  netProfit: number;
  roi: number;
  floorQty: number;
  backroomQty: number;
  aisle: string | null;
  isLowestPrice: boolean;
  excluded: boolean;
  purchased: boolean;
  purchasedQty: number;
}

export interface Purchase {
  dealId: number;
  productId: number;
  productName: string;
  productUrl: string | null;
  storeNumber: number;
  city: string;
  state: string;
  storePrice: number;
  msrp: number;
  netProfit: number;
  roi: number;
  purchasedQty: number;
  totalProfit: number;
  purchasedAt: string;
}

export function getAggregatedStores(): AggregatedStore[] {
  const db = getDb();

  const minProfit = parseFloat(process.env.MIN_PROFIT_PER_UNIT || "5");

  const storeRows = db.prepare(`
    SELECT
      s.id as store_id,
      s.store_number,
      s.city,
      s.state,
      s.address,
      s.zip,
      s.distance_miles,
      COUNT(CASE WHEN sd.excluded = 0 AND sd.purchased = 0 THEN 1 END) as deal_count,
      SUM(CASE WHEN sd.excluded = 0 AND sd.purchased = 0 THEN sd.unit_profit * (sd.floor_qty + sd.backroom_qty) ELSE 0 END) as total_profit,
      SUM(CASE WHEN sd.excluded = 0 AND sd.purchased = 0 THEN sd.floor_qty + sd.backroom_qty ELSE 0 END) as total_qty
    FROM stores s
    JOIN store_deals sd ON sd.store_id = s.id
    WHERE sd.aisle IS NOT NULL AND sd.aisle != ''
      AND sd.unit_profit >= ?
      AND sd.purchased = 0
    GROUP BY s.id
    HAVING total_qty > 0
    ORDER BY (total_profit / NULLIF(s.distance_miles, 0)) DESC
  `).all(minProfit) as Array<{
    store_id: number;
    store_number: number;
    city: string;
    state: string;
    address: string;
    zip: string;
    distance_miles: number;
    deal_count: number;
    total_profit: number;
    total_qty: number;
  }>;

  const dealStmt = db.prepare(`
    SELECT
      sd.id as deal_id,
      p.id as product_id,
      p.name as product_name,
      p.product_url,
      p.msrp,
      sd.store_price,
      sd.unit_profit,
      sd.floor_qty,
      sd.backroom_qty,
      sd.aisle,
      sd.is_lowest_price,
      sd.excluded,
      sd.purchased,
      sd.purchased_qty
    FROM store_deals sd
    JOIN products p ON p.id = sd.product_id
    WHERE sd.store_id = ?
      AND sd.aisle IS NOT NULL AND sd.aisle != ''
      AND sd.unit_profit >= ?
      AND sd.purchased = 0
  `);

  return storeRows.map((row) => {
    const deals = dealStmt.all(row.store_id, minProfit) as Array<{
      deal_id: number;
      product_id: number;
      product_name: string;
      product_url: string | null;
      msrp: number;
      store_price: number;
      unit_profit: number;
      floor_qty: number;
      backroom_qty: number;
      aisle: string | null;
      is_lowest_price: number;
      excluded: number;
      purchased: number;
      purchased_qty: number;
    }>;

    const distanceMiles = row.distance_miles || 1;
    const totalProfit = row.total_profit || 0;

    return {
      storeId: row.store_id,
      storeNumber: row.store_number,
      city: row.city,
      state: row.state,
      address: row.address,
      zip: row.zip,
      distanceMiles: row.distance_miles,
      dealCount: row.deal_count,
      totalProfit,
      totalQty: row.total_qty,
      score: Math.round((totalProfit / distanceMiles) * 100) / 100,
      deals: deals.map((d) => ({
        dealId: d.deal_id,
        productId: d.product_id,
        productName: d.product_name,
        productUrl: d.product_url,
        msrp: d.msrp,
        storePrice: d.store_price,
        netProfit: d.unit_profit,
        roi: d.store_price > 0 ? Math.round((d.unit_profit / d.store_price) * 100) : 0,
        floorQty: d.floor_qty,
        backroomQty: d.backroom_qty,
        aisle: d.aisle,
        isLowestPrice: d.is_lowest_price === 1,
        excluded: d.excluded === 1,
        purchased: d.purchased === 1,
        purchasedQty: d.purchased_qty,
      })),
    };
  });
}

export function getPurchases(): Purchase[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      sd.id as deal_id,
      p.id as product_id,
      p.name as product_name,
      p.product_url,
      s.store_number,
      s.city,
      s.state,
      sd.store_price,
      p.msrp,
      sd.unit_profit,
      sd.purchased_qty,
      sd.created_at as purchased_at
    FROM store_deals sd
    JOIN products p ON p.id = sd.product_id
    JOIN stores s ON s.id = sd.store_id
    WHERE sd.purchased = 1
    ORDER BY sd.created_at DESC
  `).all() as Array<{
    deal_id: number;
    product_id: number;
    product_name: string;
    product_url: string | null;
    store_number: number;
    city: string;
    state: string;
    store_price: number;
    msrp: number;
    unit_profit: number;
    purchased_qty: number;
    purchased_at: string;
  }>;

  return rows.map((r) => ({
    dealId: r.deal_id,
    productId: r.product_id,
    productName: r.product_name,
    productUrl: r.product_url,
    storeNumber: r.store_number,
    city: r.city,
    state: r.state,
    storePrice: r.store_price,
    msrp: r.msrp,
    netProfit: r.unit_profit,
    roi: r.store_price > 0 ? Math.round((r.unit_profit / r.store_price) * 100) : 0,
    purchasedQty: r.purchased_qty,
    totalProfit: r.unit_profit * r.purchased_qty,
    purchasedAt: r.purchased_at,
  }));
}
