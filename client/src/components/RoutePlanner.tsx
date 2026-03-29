import { useState } from "react";
import type { PlannedRoute } from "../lib/api";
import { fetchRoute } from "../lib/api";

const C = {
  bg: "#111",
  border: "rgba(255,255,255,0.06)",
  gold: "#c8a44e",
  green: "#4aba6a",
  amber: "#d4a24e",
  muted: "#555",
  text: "#ccc",
};

export function RoutePlanner() {
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxStops, setMaxStops] = useState(8);
  const [minProfit, setMinProfit] = useState(5);
  const [maxDistance, setMaxDistance] = useState(100);

  const generateRoute = async () => {
    setLoading(true);
    try { setRoute(await fetchRoute({ maxStops, minProfit, maxDistance })); }
    finally { setLoading(false); }
  };

  const inputStyle = { background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.text };

  return (
    <div>
      <div className="rounded-md p-5 mb-5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <div className="flex gap-5 items-end flex-wrap">
          {[
            { label: "Max Stops", value: maxStops, set: setMaxStops, w: "w-20" },
            { label: "Min Net ($)", value: minProfit, set: setMinProfit, w: "w-20" },
            { label: "Max Dist (mi)", value: maxDistance, set: setMaxDistance, w: "w-24" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-[10px] tracking-widest uppercase mb-1.5" style={{ color: C.muted }}>{f.label}</label>
              <input
                type="number" value={f.value}
                onChange={(e) => f.set(Number(e.target.value))}
                className={`${f.w} rounded-md px-3 py-2 text-sm focus:outline-none`}
                style={inputStyle}
              />
            </div>
          ))}
          <button
            onClick={generateRoute} disabled={loading}
            className="px-6 py-2 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
            style={{ background: C.gold, color: "#000" }}
          >
            {loading ? "Planning..." : "Generate Route"}
          </button>
        </div>
      </div>

      {route && route.stops.length > 0 && (
        <>
          {/* Summary */}
          <div className="rounded-md p-4 md:p-5 mb-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-[10px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>Net Profit</div>
                <div className="text-xl md:text-3xl font-semibold" style={{ color: C.green }}>${route.totalProfit.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>Distance</div>
                <div className="text-xl md:text-2xl font-semibold" style={{ color: C.text }}>{route.totalDistance.toFixed(1)} mi</div>
              </div>
              <div>
                <div className="text-[10px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>Stops</div>
                <div className="text-xl md:text-2xl font-semibold" style={{ color: C.text }}>{route.stops.length}</div>
              </div>
            </div>
            {route.googleMapsUrl && (
              <a href={route.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center py-3 rounded-md text-sm font-semibold tracking-wide uppercase transition-colors"
                style={{ background: C.gold, color: "#000" }}>
                Open Route in Google Maps
              </a>
            )}
          </div>

          {/* Stops */}
          <div className="space-y-1">
            {route.stops.map((stop) => (
              <div key={stop.store.storeId} className="rounded-md p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: C.gold, color: "#000" }}>
                    {stop.stopOrder}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium" style={{ color: C.text }}>Store #{stop.store.storeNumber}</span>
                        <span className="ml-2" style={{ color: C.muted }}>{stop.store.city}, {stop.store.state}</span>
                        <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                          {stop.store.address}, {stop.store.zip} · {stop.store.distanceMiles}mi
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold" style={{ color: C.green }}>${stop.store.totalProfit.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {stop.store.deals.filter(d => !d.excluded).map((deal, i) => (
                        <div key={i} className="flex items-center justify-between text-[13px] px-3 py-1.5 rounded-sm" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="flex items-center gap-2">
                            {deal.productUrl ? (
                              <a href={deal.productUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: C.gold }}>{deal.productName}</a>
                            ) : (
                              <span style={{ color: C.text }}>{deal.productName}</span>
                            )}
                            {deal.aisle && <span className="text-[10px] font-mono px-1 py-px rounded-sm" style={{ background: "rgba(255,255,255,0.03)", color: C.muted }}>{deal.aisle}</span>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3 tabular-nums">
                            <span style={{ color: C.amber }}>${deal.storePrice.toFixed(2)}</span>
                            <span style={{ color: C.muted }}>→</span>
                            <span style={{ color: C.green }}>${deal.netProfit.toFixed(2)}</span>
                            <span className="text-xs" style={{ color: C.muted }}>x{deal.floorQty + deal.backroomQty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {route && route.stops.length === 0 && (
        <div className="text-center py-16" style={{ color: C.muted }}>
          No stores match your criteria. Lower min profit or increase distance.
        </div>
      )}

      {!route && (
        <div className="text-center py-16" style={{ color: C.muted }}>
          Set your preferences and generate a route.
        </div>
      )}
    </div>
  );
}
