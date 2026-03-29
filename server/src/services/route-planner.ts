import type { AggregatedStore } from "./store-aggregator.js";

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

interface RouteOptions {
  minProfitPerStore?: number;
  maxStops?: number;
  maxTotalDistance?: number;
}

export function planRoute(
  stores: AggregatedStore[],
  options: RouteOptions = {}
): PlannedRoute {
  const {
    minProfitPerStore = 5,
    maxStops = 8,
    maxTotalDistance = 100,
  } = options;

  // Filter stores meeting minimum profit
  const eligible = stores.filter((s) => s.totalProfit >= minProfitPerStore);

  if (eligible.length === 0) {
    return { stops: [], totalDistance: 0, totalProfit: 0, googleMapsUrl: "" };
  }

  // Greedy nearest-neighbor with profit-density scoring
  const visited = new Set<number>();
  const stops: RouteStop[] = [];
  let totalDistance = 0;
  let totalProfit = 0;

  while (stops.length < maxStops && visited.size < eligible.length) {
    let bestStore: AggregatedStore | null = null;
    let bestScore = -1;

    for (const store of eligible) {
      if (visited.has(store.storeId)) continue;

      // For simplicity, use distance from home (Tempo already provides this)
      // A more sophisticated version would calculate incremental distance
      const effectiveDistance = store.distanceMiles || 1;

      // Would adding this store exceed our distance budget?
      if (totalDistance + effectiveDistance > maxTotalDistance) continue;

      const score = store.totalProfit / effectiveDistance;
      if (score > bestScore) {
        bestScore = score;
        bestStore = store;
      }
    }

    if (!bestStore) break;

    visited.add(bestStore.storeId);
    totalDistance += bestStore.distanceMiles;
    totalProfit += bestStore.totalProfit;

    stops.push({
      store: bestStore,
      stopOrder: stops.length + 1,
      cumulativeDistance: totalDistance,
      cumulativeProfit: totalProfit,
    });
  }

  // Sort stops by distance (closest first) for efficient driving
  stops.sort((a, b) => a.store.distanceMiles - b.store.distanceMiles);
  stops.forEach((s, i) => {
    s.stopOrder = i + 1;
  });

  // Recalculate cumulative values after sorting
  let cumDist = 0;
  let cumProfit = 0;
  for (const stop of stops) {
    cumDist += stop.store.distanceMiles;
    cumProfit += stop.store.totalProfit;
    stop.cumulativeDistance = cumDist;
    stop.cumulativeProfit = cumProfit;
  }

  const googleMapsUrl = buildGoogleMapsUrl(stops);

  return { stops, totalDistance, totalProfit, googleMapsUrl };
}

function buildGoogleMapsUrl(stops: RouteStop[]): string {
  if (stops.length === 0) return "";

  const homeCity = process.env.HOME_CITY || "Orem, UT";
  const home = encodeURIComponent(homeCity);

  const waypoints = stops.map((s) => {
    const addr = `${s.store.address}, ${s.store.city}, ${s.store.state} ${s.store.zip}`;
    return encodeURIComponent(addr);
  });

  // Start from home, hit all stores, end at last store
  return `https://www.google.com/maps/dir/${home}/${waypoints.join("/")}`;
}

export function formatRouteForDiscord(route: PlannedRoute): string {
  if (route.stops.length === 0) {
    return "No profitable stores found matching your criteria.";
  }

  let msg = `**Optimized Route (${route.stops.length} stops)**\n`;
  msg += `Net Profit: **$${route.totalProfit.toFixed(2)}** (after fees) | Distance: **${route.totalDistance.toFixed(1)} mi**\n\n`;

  for (const stop of route.stops) {
    const s = stop.store;
    msg += `**${stop.stopOrder}. Store #${s.storeNumber} - ${s.city}, ${s.state}** (${s.distanceMiles}mi)\n`;
    msg += `   Profit: $${s.totalProfit.toFixed(2)} | ${s.dealCount} deal(s) | Score: ${s.score}/mi\n`;

    for (const deal of s.deals.filter((d) => !d.excluded)) {
      const qty = deal.floorQty + deal.backroomQty;
      const loc = deal.aisle ? ` [${deal.aisle}]` : "";
      const link = deal.productUrl ? `[${deal.productName}](${deal.productUrl})` : deal.productName;
      msg += `   • ${link}: $${deal.storePrice} → net $${deal.netProfit.toFixed(2)} (${deal.roi}% ROI) x${qty}${loc}\n`;
    }
    msg += "\n";
  }

  if (route.googleMapsUrl) {
    msg += `[Open in Google Maps](${route.googleMapsUrl})`;
  }

  return msg;
}
