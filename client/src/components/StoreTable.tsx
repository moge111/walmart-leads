import { useState } from "react";
import type { AggregatedStore } from "../lib/api";
import { excludeDeal, includeDeal, updateMsrp, purchaseDeal, unpurchaseDeal } from "../lib/api";

interface Props {
  stores: AggregatedStore[];
  onUpdate: () => void;
}

const C = {
  bg: "#111",
  bgHover: "#151515",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.1)",
  gold: "#c8a44e",
  green: "#4aba6a",
  red: "#c45c5c",
  amber: "#d4a24e",
  muted: "#555",
  text: "#ccc",
  dim: "#333",
};

export function StoreTable({ stores, onUpdate }: Props) {
  const [expandedStore, setExpandedStore] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "profit" | "distance" | "deals">("score");
  const [editingMsrp, setEditingMsrp] = useState<{ dealId: number; productId: number; value: string } | null>(null);
  const [purchasingDeal, setPurchasingDeal] = useState<{ dealId: number; qty: string } | null>(null);

  const sorted = [...stores].sort((a, b) => {
    switch (sortBy) {
      case "score": return b.score - a.score;
      case "profit": return b.totalProfit - a.totalProfit;
      case "distance": return a.distanceMiles - b.distanceMiles;
      case "deals": return b.dealCount - a.dealCount;
    }
  });

  const toggleDeal = async (dealId: number, excluded: boolean) => {
    if (excluded) await includeDeal(dealId);
    else await excludeDeal(dealId);
    onUpdate();
  };

  const savePurchase = async () => {
    if (!purchasingDeal) return;
    const qty = parseInt(purchasingDeal.qty);
    if (isNaN(qty) || qty < 0) return;
    await purchaseDeal(purchasingDeal.dealId, qty);
    setPurchasingDeal(null);
    onUpdate();
  };

  const handleUnpurchase = async (dealId: number) => {
    await unpurchaseDeal(dealId);
    onUpdate();
  };

  const saveMsrp = async () => {
    if (!editingMsrp) return;
    const val = parseFloat(editingMsrp.value);
    if (isNaN(val) || val <= 0) return;
    await updateMsrp(editingMsrp.productId, val);
    setEditingMsrp(null);
    onUpdate();
  };

  if (stores.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: C.muted }}>
        <div className="text-3xl mb-2">—</div>
        <div>No active deals</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {(["score", "profit", "distance", "deals"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className="px-3 py-1 text-[11px] tracking-wide uppercase rounded-sm transition-colors"
            style={{
              background: sortBy === key ? "rgba(200,164,78,0.12)" : "transparent",
              color: sortBy === key ? C.gold : C.muted,
              border: sortBy === key ? `1px solid rgba(200,164,78,0.2)` : "1px solid transparent",
            }}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {sorted.map((store) => {
          const isExpanded = expandedStore === store.storeId;
          const bestRoi = Math.max(...store.deals.filter(d => !d.excluded).map(d => d.roi), 0);

          return (
            <div key={store.storeId} className="rounded-md overflow-hidden" style={{ background: isExpanded ? C.bg : "transparent", border: `1px solid ${isExpanded ? C.borderHover : C.border}` }}>
              <button
                onClick={() => setExpandedStore(isExpanded ? null : store.storeId)}
                className="w-full px-4 py-3.5 text-left transition-colors"
                style={{ background: isExpanded ? C.bg : "rgba(17,17,17,0.5)" }}
                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = C.bg; }}
                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = "rgba(17,17,17,0.5)"; }}
              >
                {/* Desktop: grid layout */}
                <div className="hidden md:grid items-center" style={{ gridTemplateColumns: "70px 1fr 70px 80px 90px 120px 70px" }}>
                  <span className="text-sm font-mono font-semibold" style={{ color: C.gold }}>#{store.storeNumber}</span>
                  <span style={{ color: C.text }}>{store.city}, {store.state}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{store.distanceMiles}mi</span>
                  <span className="text-xs" style={{ color: C.muted }}>{store.totalQty} units</span>
                  <span className="text-[10px] tracking-wide px-2 py-0.5 rounded-sm text-center" style={{
                    background: bestRoi >= 200 ? "rgba(74,186,106,0.1)" : bestRoi >= 100 ? "rgba(212,162,78,0.1)" : "rgba(85,85,85,0.2)",
                    color: bestRoi >= 200 ? C.green : bestRoi >= 100 ? C.amber : C.muted,
                    border: `1px solid ${bestRoi >= 200 ? "rgba(74,186,106,0.15)" : bestRoi >= 100 ? "rgba(212,162,78,0.15)" : "rgba(85,85,85,0.15)"}`,
                  }}>
                    {bestRoi}% ROI
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-right" style={{ color: C.green }}>${store.totalProfit.toFixed(2)}</span>
                  <span className="text-xs text-right" style={{ color: C.muted }}>{store.score} $/mi</span>
                </div>

                {/* Mobile: stacked layout */}
                <div className="md:hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold" style={{ color: C.gold }}>#{store.storeNumber}</span>
                      <span style={{ color: C.text }}>{store.city}, {store.state}</span>
                    </div>
                    <span className="text-lg font-semibold tabular-nums" style={{ color: C.green }}>${store.totalProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: C.muted }}>{store.distanceMiles}mi</span>
                    <span className="text-xs" style={{ color: C.muted }}>{store.totalQty} units</span>
                    <span className="text-[10px] tracking-wide px-2 py-0.5 rounded-sm" style={{
                      background: bestRoi >= 200 ? "rgba(74,186,106,0.1)" : bestRoi >= 100 ? "rgba(212,162,78,0.1)" : "rgba(85,85,85,0.2)",
                      color: bestRoi >= 200 ? C.green : bestRoi >= 100 ? C.amber : C.muted,
                      border: `1px solid ${bestRoi >= 200 ? "rgba(74,186,106,0.15)" : bestRoi >= 100 ? "rgba(212,162,78,0.15)" : "rgba(85,85,85,0.15)"}`,
                    }}>
                      {bestRoi}% ROI
                    </span>
                    <span className="text-xs" style={{ color: C.muted }}>{store.score} $/mi</span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div className="text-[11px] py-2.5" style={{ color: "#aaa" }}>
                    {store.address}, {store.zip}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr style={{ color: C.muted }}>
                          <th className="pb-2 text-left text-[10px] tracking-widest uppercase font-normal">Product</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-16">Buy</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-16">Sells</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-16">Net</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-14">ROI</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-10">Qty</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-16">Aisle</th>
                          <th className="pb-2 text-right text-[10px] tracking-widest uppercase font-normal w-20">Got</th>
                          <th className="pb-2 w-14"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {store.deals.map((deal) => (
                          <tr key={deal.dealId} style={{ opacity: deal.excluded ? 0.25 : 1, borderTop: `1px solid ${C.border}` }}>
                            <td className="py-2 pr-4">
                              {deal.productUrl ? (
                                <a href={deal.productUrl} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2" style={{ color: C.gold }}>
                                  {deal.productName}
                                </a>
                              ) : (
                                <span style={{ color: C.text }}>{deal.productName}</span>
                              )}
                              {deal.isLowestPrice && <span className="ml-1.5 text-[9px] px-1 py-px rounded-sm" style={{ background: "rgba(212,162,78,0.12)", color: C.amber, border: "1px solid rgba(212,162,78,0.15)" }}>LOW</span>}
                            </td>
                            <td className="py-2 text-right tabular-nums" style={{ color: C.amber }}>${deal.storePrice.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              {editingMsrp?.dealId === deal.dealId ? (
                                <span className="inline-flex items-center gap-1">
                                  <input type="number" step="0.01" value={editingMsrp.value}
                                    onChange={(e) => setEditingMsrp({ ...editingMsrp, value: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveMsrp(); if (e.key === "Escape") setEditingMsrp(null); }}
                                    className="w-16 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none"
                                    style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.gold}`, color: C.text }}
                                    autoFocus />
                                  <button onClick={saveMsrp} style={{ color: C.green }} className="text-xs">✓</button>
                                  <button onClick={() => setEditingMsrp(null)} style={{ color: C.muted }} className="text-xs">✕</button>
                                </span>
                              ) : (
                                <button onClick={() => setEditingMsrp({ dealId: deal.dealId, productId: deal.productId, value: deal.msrp.toFixed(2) })}
                                  className="hover:underline underline-offset-2 decoration-dashed cursor-pointer tabular-nums"
                                  style={{ color: C.muted }}>${deal.msrp.toFixed(2)}</button>
                              )}
                            </td>
                            <td className="py-2 text-right font-medium tabular-nums" style={{ color: deal.netProfit > 0 ? C.green : C.red }}>${deal.netProfit.toFixed(2)}</td>
                            <td className="py-2 text-right">
                              <span className="text-[11px] tabular-nums" style={{ color: deal.roi >= 200 ? C.green : deal.roi >= 100 ? C.amber : C.muted }}>{deal.roi}%</span>
                            </td>
                            <td className="py-2 text-right tabular-nums" style={{ color: C.text }}>{deal.floorQty + deal.backroomQty}</td>
                            <td className="py-2 text-right">
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", color: C.muted }}>{deal.aisle}</span>
                            </td>
                            <td className="py-2 text-right">
                              {deal.purchased ? (
                                <button onClick={() => handleUnpurchase(deal.dealId)} className="text-[11px] px-2 py-0.5 rounded-sm" title="Click to undo"
                                  style={{ background: "rgba(200,164,78,0.1)", color: C.gold, border: "1px solid rgba(200,164,78,0.2)" }}>
                                  ✓ {deal.purchasedQty}
                                </button>
                              ) : purchasingDeal?.dealId === deal.dealId ? (
                                <span className="inline-flex items-center gap-1">
                                  <input type="number" min="0" value={purchasingDeal.qty}
                                    onChange={(e) => setPurchasingDeal({ ...purchasingDeal, qty: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === "Enter") savePurchase(); if (e.key === "Escape") setPurchasingDeal(null); }}
                                    className="w-12 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none"
                                    style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.gold}`, color: C.text }}
                                    autoFocus />
                                  <button onClick={savePurchase} style={{ color: C.green }} className="text-xs">✓</button>
                                  <button onClick={() => setPurchasingDeal(null)} style={{ color: C.muted }} className="text-xs">✕</button>
                                </span>
                              ) : (
                                <button onClick={() => setPurchasingDeal({ dealId: deal.dealId, qty: String(deal.floorQty + deal.backroomQty) })}
                                  className="text-[11px] px-2 py-0.5 rounded-sm transition-colors"
                                  style={{ background: "rgba(200,164,78,0.06)", color: C.gold, border: "1px solid rgba(200,164,78,0.12)" }}>
                                  Bought
                                </button>
                              )}
                            </td>
                            <td className="py-2 text-right">
                              <button onClick={() => toggleDeal(deal.dealId, deal.excluded)} className="text-[11px] px-2 py-0.5 rounded-sm transition-colors"
                                style={{ background: deal.excluded ? "rgba(74,186,106,0.08)" : "rgba(255,255,255,0.03)", color: deal.excluded ? C.green : C.muted, border: `1px solid ${deal.excluded ? "rgba(74,186,106,0.12)" : "rgba(255,255,255,0.04)"}` }}>
                                {deal.excluded ? "Add" : "Skip"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-2">
                    {store.deals.map((deal) => (
                      <div key={deal.dealId} className="rounded-md p-3" style={{ opacity: deal.excluded ? 0.25 : 1, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            {deal.productUrl ? (
                              <a href={deal.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline underline-offset-2 block" style={{ color: C.gold }}>
                                {deal.productName}
                              </a>
                            ) : (
                              <span className="text-sm" style={{ color: C.text }}>{deal.productName}</span>
                            )}
                          </div>
                          <button onClick={() => toggleDeal(deal.dealId, deal.excluded)} className="text-[11px] px-2.5 py-1 rounded-sm shrink-0"
                            style={{ background: deal.excluded ? "rgba(74,186,106,0.08)" : "rgba(255,255,255,0.03)", color: deal.excluded ? C.green : C.muted, border: `1px solid ${deal.excluded ? "rgba(74,186,106,0.12)" : "rgba(255,255,255,0.04)"}` }}>
                            {deal.excluded ? "Add" : "Skip"}
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Buy</span>
                            <span className="tabular-nums font-medium" style={{ color: C.amber }}>${deal.storePrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Sells</span>
                            <button onClick={() => setEditingMsrp({ dealId: deal.dealId, productId: deal.productId, value: deal.msrp.toFixed(2) })}
                              className="tabular-nums" style={{ color: C.muted }}>${deal.msrp.toFixed(2)}</button>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Net</span>
                            <span className="tabular-nums font-semibold" style={{ color: deal.netProfit > 0 ? C.green : C.red }}>${deal.netProfit.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>ROI</span>
                            <span className="tabular-nums" style={{ color: deal.roi >= 200 ? C.green : deal.roi >= 100 ? C.amber : C.muted }}>{deal.roi}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Qty</span>
                            <span className="tabular-nums" style={{ color: C.text }}>{deal.floorQty + deal.backroomQty}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Aisle</span>
                            <span className="text-sm font-mono font-semibold" style={{ color: "#eee" }}>{deal.aisle}</span>
                          </div>
                        </div>
                        {editingMsrp?.dealId === deal.dealId && (
                          <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                            <span className="text-xs" style={{ color: C.muted }}>Sell price: $</span>
                            <input type="number" step="0.01" value={editingMsrp.value}
                              onChange={(e) => setEditingMsrp({ ...editingMsrp, value: e.target.value })}
                              className="w-20 rounded px-2 py-1 text-sm text-right focus:outline-none"
                              style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.gold}`, color: C.text }}
                              autoFocus />
                            <button onClick={saveMsrp} className="text-sm px-2 py-1 rounded" style={{ background: "rgba(74,186,106,0.1)", color: C.green }}>Save</button>
                            <button onClick={() => setEditingMsrp(null)} className="text-sm" style={{ color: C.muted }}>Cancel</button>
                          </div>
                        )}
                        <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                          {deal.purchased ? (
                            <button onClick={() => handleUnpurchase(deal.dealId)}
                              className="w-full py-1.5 rounded text-sm font-medium"
                              style={{ background: "rgba(200,164,78,0.1)", color: C.gold, border: "1px solid rgba(200,164,78,0.2)" }}>
                              ✓ Bought {deal.purchasedQty} — tap to undo
                            </button>
                          ) : purchasingDeal?.dealId === deal.dealId ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm" style={{ color: C.muted }}>How many?</span>
                              <input type="number" min="0" value={purchasingDeal.qty}
                                onChange={(e) => setPurchasingDeal({ ...purchasingDeal, qty: e.target.value })}
                                className="w-16 rounded px-2 py-1 text-sm text-right focus:outline-none"
                                style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.gold}`, color: C.text }}
                                autoFocus />
                              <button onClick={savePurchase} className="px-3 py-1 rounded text-sm" style={{ background: "rgba(74,186,106,0.1)", color: C.green }}>Save</button>
                              <button onClick={() => setPurchasingDeal(null)} className="text-sm" style={{ color: C.muted }}>Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setPurchasingDeal({ dealId: deal.dealId, qty: String(deal.floorQty + deal.backroomQty) })}
                              className="w-full py-1.5 rounded text-sm font-medium"
                              style={{ background: "rgba(200,164,78,0.06)", color: C.gold, border: "1px solid rgba(200,164,78,0.12)" }}>
                              Mark as Bought
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
