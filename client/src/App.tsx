import { useState, useEffect, useCallback } from "react";
import { StoreTable } from "./components/StoreTable";
import { RoutePlanner } from "./components/RoutePlanner";
import { PasteBox } from "./components/PasteBox";
import { Purchases } from "./components/Purchases";
import { fetchStores, clearLeads, fetchPurchases } from "./lib/api";
import type { AggregatedStore, Purchase } from "./lib/api";

type Tab = "stores" | "route" | "paste" | "purchases";

function App() {
  const [tab, setTab] = useState<Tab>("stores");
  const [stores, setStores] = useState<AggregatedStore[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [storeData, purchaseData] = await Promise.all([fetchStores(), fetchPurchases()]);
      setStores(storeData);
      setPurchases(purchaseData);
    } catch {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleClear = async () => {
    if (confirm("Clear all leads and start fresh?")) {
      await clearLeads();
      loadAll();
    }
  };

  const totalProfit = stores.reduce((s, st) => s + st.totalProfit, 0);
  const totalDeals = stores.reduce((s, st) => s + st.dealCount, 0);
  const totalUnits = stores.reduce((s, st) => s + st.totalQty, 0);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl tracking-tight" style={{ color: "#c8a44e", fontWeight: 700 }}>
              WALMART LEADS
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={loadAll} className="text-xs tracking-wide uppercase" style={{ color: "#555" }}>
              Refresh
            </button>
            <button onClick={handleClear} className="text-xs tracking-wide uppercase" style={{ color: "#8b4444" }}>
              Clear
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Stats row */}
        {stores.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            {[
              { label: "STORES", value: stores.length, color: "#ccc" },
              { label: "DEALS", value: totalDeals, color: "#ccc" },
              { label: "UNITS", value: totalUnits, color: "#ccc" },
              { label: "NET PROFIT", value: `$${totalProfit.toFixed(0)}`, color: "#4aba6a" },
            ].map((stat) => (
              <div key={stat.label} className="py-3 px-4 rounded-lg" style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] tracking-widest mb-1" style={{ color: "#555" }}>{stat.label}</div>
                <div className="text-2xl font-semibold" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {(["stores", "route", "paste", "purchases"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { stores: "Stores", route: "Route", paste: "Paste", purchases: "Purchases" };
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-5 py-3 text-xs tracking-wide uppercase transition-colors"
                style={{
                  color: isActive ? "#c8a44e" : "#5a5549",
                  borderBottom: isActive ? "2px solid #c8a44e" : "2px solid transparent",
                }}
              >
                {labels[t]}
                {t === "stores" && stores.length > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: isActive ? "rgba(200,164,78,0.15)" : "rgba(255,255,255,0.04)", color: isActive ? "#c8a44e" : "#5a5549" }}>
                    {stores.length}
                  </span>
                )}
                {t === "purchases" && purchases.length > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: isActive ? "rgba(200,164,78,0.15)" : "rgba(255,255,255,0.04)", color: isActive ? "#c8a44e" : "#5a5549" }}>
                    {purchases.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && stores.length === 0 ? (
          <div className="text-center py-20" style={{ color: "#555" }}>Loading...</div>
        ) : (
          <>
            {tab === "stores" && <StoreTable stores={stores} onUpdate={loadAll} />}
            {tab === "route" && <RoutePlanner />}
            {tab === "paste" && <PasteBox onParsed={loadAll} />}
            {tab === "purchases" && <Purchases onUpdate={loadAll} />}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
