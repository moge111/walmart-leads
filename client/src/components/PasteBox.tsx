import { useState } from "react";
import { parseMessage } from "../lib/api";

const C = {
  bg: "#111",
  border: "rgba(255,255,255,0.06)",
  gold: "#c8a44e",
  green: "#4aba6a",
  red: "#c45c5c",
  muted: "#555",
  text: "#ccc",
};

interface Props { onParsed: () => void; }

export function PasteBox({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true); setStatus(null);
    try {
      const result = await parseMessage(text);
      if (result.error) { setStatus({ type: "error", msg: result.error }); }
      else {
        setStatus({ type: "success", msg: `Parsed "${result.product}" — ${result.storesFound} stores` });
        setText(""); onParsed();
      }
    } catch { setStatus({ type: "error", msg: "Failed to connect" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-md p-5" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
        <label className="block text-[10px] tracking-widest uppercase mb-2" style={{ color: C.muted }}>Tempo Message</label>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Paste a Tempo Monitor message here..."
          className="w-full h-40 rounded-md p-4 text-sm resize-y focus:outline-none"
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, color: C.text }}
        />
        <div className="flex items-center justify-between mt-3">
          <button onClick={handleSubmit} disabled={loading || !text.trim()}
            className="px-5 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ background: C.gold, color: "#000" }}>
            {loading ? "Parsing..." : "Parse Lead"}
          </button>
          {status && <span className="text-sm" style={{ color: status.type === "success" ? C.green : C.red }}>{status.msg}</span>}
        </div>
      </div>
    </div>
  );
}
