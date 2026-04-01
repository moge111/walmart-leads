const BASE = import.meta.env.VITE_API_URL || "";

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

export interface RouteStop {
  store: AggregatedStore;
  stopOrder: number;
  cumulativeDistance: number;
  cumulativeProfit: number;
}

export interface PlannedRoute {
  stops: RouteStop[];
  totalDistance: number;
  totalProfit: number;
  googleMapsUrl: string;
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

export interface Lead {
  id: number;
  name: string;
  msrp: number;
  sku: string;
  upc: string;
  created_at: string;
  store_count: number;
  lowest_price: number;
}

export async function fetchStores(hours = 24): Promise<AggregatedStore[]> {
  const res = await fetch(`${BASE}/api/stores?hours=${hours}`);
  return res.json();
}

export async function fetchRoute(options?: {
  minProfit?: number;
  maxStops?: number;
  maxDistance?: number;
  storeIds?: number[];
}): Promise<PlannedRoute> {
  const params = new URLSearchParams();
  if (options?.minProfit) params.set("minProfit", String(options.minProfit));
  if (options?.maxStops) params.set("maxStops", String(options.maxStops));
  if (options?.maxDistance) params.set("maxDistance", String(options.maxDistance));
  if (options?.storeIds?.length) params.set("storeIds", options.storeIds.join(","));
  const res = await fetch(`${BASE}/api/route?${params}`);
  return res.json();
}

export async function fetchLeads(hours = 24): Promise<Lead[]> {
  const res = await fetch(`${BASE}/api/leads?hours=${hours}`);
  return res.json();
}

export async function parseMessage(message: string) {
  const res = await fetch(`${BASE}/api/leads/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function clearLeads() {
  const res = await fetch(`${BASE}/api/leads`, { method: "DELETE" });
  return res.json();
}

export async function excludeDeal(dealId: number) {
  const res = await fetch(`${BASE}/api/leads/deals/${dealId}/exclude`, { method: "PATCH" });
  return res.json();
}

export async function includeDeal(dealId: number) {
  const res = await fetch(`${BASE}/api/leads/deals/${dealId}/include`, { method: "PATCH" });
  return res.json();
}

export async function purchaseDeal(dealId: number, qty: number) {
  const res = await fetch(`${BASE}/api/leads/deals/${dealId}/purchase`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qty }),
  });
  return res.json();
}

export async function unpurchaseDeal(dealId: number) {
  const res = await fetch(`${BASE}/api/leads/deals/${dealId}/unpurchase`, { method: "PATCH" });
  return res.json();
}

export async function updateMsrp(productId: number, msrp: number) {
  const res = await fetch(`${BASE}/api/leads/products/${productId}/msrp`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msrp }),
  });
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE}/api/leads/config`);
  return res.json();
}

export async function sendRouteToDiscord(storeIds?: number[]): Promise<{ sent: boolean; error?: string }> {
  const res = await fetch(`${BASE}/api/route/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeIds }),
  });
  return res.json();
}

export async function fetchPurchases(): Promise<Purchase[]> {
  const res = await fetch(`${BASE}/api/purchases`);
  return res.json();
}
