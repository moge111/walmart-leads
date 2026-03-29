import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { initializeDatabase } from "./db/schema.js";
import { createBot } from "./bot.js";
import leadsRouter from "./routes/leads.js";
import storesRouter from "./routes/stores.js";
import routesRouter from "./routes/routes.js";

const PORT = parseInt(process.env.API_PORT || "3001");
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const LEADS_CHANNEL_ID = process.env.LEADS_CHANNEL_ID;
const ROUTE_CHANNEL_ID = process.env.ROUTE_CHANNEL_ID;

// Initialize database
initializeDatabase();
console.log("Database initialized");

// Express API
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/leads", leadsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/route", routesRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve built client files
const clientDist = path.join(process.cwd(), "client", "dist");
app.use(express.static(clientDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Discord bot
if (DISCORD_TOKEN && LEADS_CHANNEL_ID && ROUTE_CHANNEL_ID) {
  createBot(DISCORD_TOKEN, LEADS_CHANNEL_ID, ROUTE_CHANNEL_ID);
} else {
  console.warn("DISCORD_TOKEN or channel IDs not set — bot disabled. API-only mode.");
}
