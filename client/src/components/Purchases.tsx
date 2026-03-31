import { useState, useEffect } from "react";
import { fetchPurchases, unpurchaseDeal, purchaseDeal } from "../lib/api";
import type { Purchase } from "../lib/api";

const C = {
  bg: "#111",
  border: "rgba(255,255,255,0.06)",
  gold: "#c8a44e",
  green: "#4aba6a",
  amber: "#d4a24e",
  muted: "#555",
  text: "#ccc",
  red: "#c45c5c",
};

interface Props {
  onUpdate: () => void;
}

export function Purchases({ onUpdate }: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQty, setEditingQty] = useState<{ dealId: number; value: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPurchases();
      setPurchases(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUndo = async (dealId: number) => {
    await unpurchaseDeal(dealId);
    load();
    onUpdate();
  };

  const saveQty = async () => {
    if (!editingQty) return;
    const qty = parseInt(editingQty.value);
    if (isNaN(qty) || qty < 1) return;
    await purchaseDeal(editingQty.dealId, qty);
    setEditingQty(null);
    load();
    onUpdate();
  };

  const totalSpent = purchases.reduce((s, p) => s + p.storePrice * p.purchasedQty, 0);
  const totalProfit = purchases.reduce((s, p) => s + p.totalProfit, 0);
  const totalUnits = purchases.reduce((s, p) => s + p.purchasedQty, 0);

  if (loading) return <div className="text-center py-20" style={{ color: C.muted }}>Loading...</div>;

  if (purchases.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: C.muted }}>
        <div className="text-3xl mb-2">—</div>
        <div>No purchases yet</div>
      </div>
    );
  }

  const QtyCell = ({ p }: { p: Purchase }) => {
    if (editingQty?.dealId === p.dealId) {
      return (
        <span className="inline-flex items-center gap-1">
          <input
            type="number" min="1" value={editingQty.value}
            onChange={(e) => setEditingQty({ ...editingQty, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") saveQty(); if (e.key === "Escape") setEditingQty(null); }}
            className="w-12 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.gold}`, color: C.text }}
            autoFocus
          />
          <button onClick={saveQty} style={{ color: C.green }} className="text-xs">✓</button>
          <button onClick={() => setEditingQty(null)} style={{ color: C.muted }} className="text-xs">✕</button>
        </span>
      );
    }
    return (
      <button
        onClick={() => setEditingQty({ dealId: p.dealId, value: String(p.purchasedQty) })}
        className="tabular-nums hover:underline underline-offset-2 decoration-dashed"
        style={{ color: C.text }}
        title="Click to edit"
      >
        {p.purchasedQty}
      </button>
    );
  };

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "UNITS BOUGHT", value: totalUnits, color: C.text },
          { label: "TOTAL SPENT", value: `$${totalSpent.toFixed(2)}`, color: C.amber },
          { label: "NET PROFIT", value: `$${totalProfit.toFixed(2)}`, color: C.green },
        ].map((s) => (
          <div key={s.label} className="py-3 px-4 rounded-lg" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="text-[10px] tracking-widest mb-1" style={{ color: C.muted }}>{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: C.bg }}>
            <tr style={{ color: C.muted }}>
              <th className="px-4 py-3 text-left text-[10px] tracking-widest uppercase font-normal">Product</th>
              <th className="px-4 py-3 text-left text-[10px] tracking-widest uppercase font-normal w-32">Store</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-16">Buy</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-16">Sells</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-16">Net</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-14">ROI</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-12">Qty</th>
              <th className="px-4 py-3 text-right text-[10px] tracking-widest uppercase font-normal w-20">Total</th>
              <th className="px-4 py-3 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.dealId} style={{ borderTop: `1px solid ${C.border}` }}>
                <td className="px-4 py-3 pr-4">
                  {p.productUrl ? (
                    <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2" style={{ color: C.gold }}>
                      {p.productName}
                    </a>
                  ) : (
                    <span style={{ color: C.text }}>{p.productName}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: C.muted }}>#{p.storeNumber} {p.city}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: C.amber }}>${p.storePrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: C.muted }}>${p.msrp.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: p.netProfit > 0 ? C.green : C.red }}>${p.netProfit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-[11px]" style={{ color: p.roi >= 200 ? C.green : p.roi >= 100 ? C.amber : C.muted }}>{p.roi}%</span>
                </td>
                <td className="px-4 py-3 text-right"><QtyCell p={p} /></td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: C.green }}>${p.totalProfit.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleUndo(p.dealId)} className="text-[11px] px-2 py-0.5 rounded-sm"
                    style={{ color: C.muted, border: `1px solid rgba(255,255,255,0.06)` }}>
                    Undo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {purchases.map((p) => (
          <div key={p.dealId} className="rounded-md p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                {p.productUrl ? (
                  <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline block" style={{ color: C.gold }}>
                    {p.productName}
                  </a>
                ) : (
                  <span className="text-sm" style={{ color: C.text }}>{p.productName}</span>
                )}
                <span className="text-xs" style={{ color: C.muted }}>#{p.storeNumber} {p.city}, {p.state}</span>
              </div>
              <button onClick={() => handleUndo(p.dealId)} className="text-[11px] px-2 py-1 rounded-sm shrink-0"
                style={{ color: C.muted, border: `1px solid rgba(255,255,255,0.06)` }}>
                Undo
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <div>
                <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Buy</span>
                <span className="tabular-nums font-medium" style={{ color: C.amber }}>${p.storePrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Net</span>
                <span className="tabular-nums font-semibold" style={{ color: p.netProfit > 0 ? C.green : C.red }}>${p.netProfit.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>ROI</span>
                <span className="tabular-nums" style={{ color: p.roi >= 200 ? C.green : p.roi >= 100 ? C.amber : C.muted }}>{p.roi}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Qty</span>
                <QtyCell p={p} />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block" style={{ color: C.muted }}>Total</span>
                <span className="tabular-nums font-semibold" style={{ color: C.green }}>${p.totalProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
