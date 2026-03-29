import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { parseTempoMessage, parseTempoEmbed } from "./services/tempo-parser.js";
import { ingestLead } from "./services/lead-ingester.js";
import { getAggregatedStores } from "./services/store-aggregator.js";
import { planRoute, formatRouteForDiscord } from "./services/route-planner.js";
import { getDb } from "./db/index.js";

function isAlreadyProcessed(messageId: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT 1 FROM processed_messages WHERE message_id = ?").get(messageId);
  return !!row;
}

function markProcessed(messageId: string) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO processed_messages (message_id) VALUES (?)").run(messageId);
}

// Try all methods to extract a lead from a Discord message
function extractLead(message: Message) {
  // 1. Plain text content
  if (message.content.includes("Stock Information Walmart")) {
    return parseTempoMessage(message.content);
  }

  // 2. Embeds on the message itself (or from snapshot embeds populated by discord.js)
  for (const embed of message.embeds) {
    const result = parseTempoEmbed({
      title: embed.title ?? undefined,
      author: embed.author ? { name: embed.author.name } : undefined,
      fields: embed.fields?.map((f) => ({ name: f.name, value: f.value })),
      thumbnail: embed.thumbnail ? { url: embed.thumbnail.url } : undefined,
    });
    if (result) return result;
  }

  return null;
}

export function createBot(
  token: string,
  leadsChannelId: string,
  routeChannelId: string
): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("ready", async () => {
    console.log(`Bot logged in as ${client.user?.tag}`);
    await scanExistingLeads(token, client, leadsChannelId, routeChannelId);
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;

    if (message.content === "!route") {
      await handleRouteCommand(client, routeChannelId);
      return;
    }
    if (message.content === "!status") {
      await handleStatusCommand(message);
      return;
    }
    if (message.content === "!clear") {
      await handleClearCommand(message);
      return;
    }

    if (message.channel.id !== leadsChannelId) return;
    if (isAlreadyProcessed(message.id)) return;

    // For forwarded messages, discord.js may not populate snapshot embeds
    // Try the discord.js object first, then fall back to REST API
    let parsed = extractLead(message);

    if (!parsed && (message.flags as any)?.has?.(1 << 14)) {
      // Message has IS_FORWARDED flag — fetch raw data from REST API
      parsed = await fetchAndParseForward(token, leadsChannelId, message.id);
    }

    if (!parsed) return;

    try {
      ingestLead(parsed);
      markProcessed(message.id);
      await message.react("✅");

      const totalQty = parsed.stores.reduce((sum, s) => sum + s.floorQty + s.backroomQty, 0);
      const bestPrice = Math.min(...parsed.stores.map((s) => s.storePrice));
      const profit = parsed.msrp - bestPrice;

      await message.reply({
        content: `**${parsed.productName}**\n` +
          `MSRP: $${parsed.msrp} | Best: $${bestPrice} (save $${profit.toFixed(2)})\n` +
          `${parsed.stores.length} stores | ${totalQty} total units`,
        allowedMentions: { repliedUser: false },
      });

      await postRouteUpdate(client, routeChannelId);
    } catch (err) {
      console.error("Failed to ingest lead:", err);
      await message.react("❌");
    }
  });

  client.login(token);
  return client;
}

// Fetch a message via REST API and parse forwarded embed
async function fetchAndParseForward(
  token: string,
  channelId: string,
  messageId: string
) {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    const raw = await res.json();

    for (const snap of raw.message_snapshots ?? []) {
      const snapMsg = snap.message;
      for (const embed of snapMsg?.embeds ?? []) {
        const result = parseTempoEmbed(embed);
        if (result) return result;
      }
    }
  } catch (err) {
    console.error(`REST fetch failed for ${messageId}:`, err);
  }
  return null;
}

async function postRouteUpdate(client: Client, routeChannelId: string) {
  const routeChannel = await client.channels.fetch(routeChannelId) as TextChannel;
  if (!routeChannel) {
    console.error("Could not find route channel");
    return;
  }

  const stores = getAggregatedStores(24);
  if (stores.length === 0) return;

  const route = planRoute(stores);
  const response = formatRouteForDiscord(route);

  if (response.length > 2000) {
    const chunks = response.match(/[\s\S]{1,1900}/g) || [];
    for (const chunk of chunks) {
      await routeChannel.send(chunk);
    }
  } else {
    await routeChannel.send(response);
  }
}

async function handleRouteCommand(client: Client, routeChannelId: string) {
  const stores = getAggregatedStores(24);
  if (stores.length === 0) {
    const channel = await client.channels.fetch(routeChannelId) as TextChannel;
    if (channel) await channel.send("No leads tracked in the last 24 hours. Forward some Tempo alerts first!");
    return;
  }
  await postRouteUpdate(client, routeChannelId);
}

async function handleStatusCommand(message: Message) {
  const db = getDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT product_id) FROM store_deals WHERE created_at >= ?) as products,
      (SELECT COUNT(DISTINCT store_id) FROM store_deals WHERE created_at >= ?) as stores,
      (SELECT COUNT(*) FROM store_deals WHERE created_at >= ?) as deals
  `).get(cutoff, cutoff, cutoff) as { products: number; stores: number; deals: number };

  await message.reply(
    `**Last 24h:** ${stats.products} products | ${stats.stores} stores | ${stats.deals} deals tracked`
  );
}

async function handleClearCommand(message: Message) {
  const db = getDb();
  db.exec("DELETE FROM store_deals");
  db.exec("DELETE FROM products");
  db.exec("DELETE FROM processed_messages");
  await message.reply("All leads cleared. Ready for new data.");
}

async function scanExistingLeads(
  token: string,
  client: Client,
  leadsChannelId: string,
  routeChannelId: string
) {
  try {
    // Use REST API directly so we get full snapshot/embed data
    const res = await fetch(
      `https://discord.com/api/v10/channels/${leadsChannelId}/messages?limit=100`,
      { headers: { Authorization: `Bot ${token}` } }
    );
    const messages = await res.json();

    if (!Array.isArray(messages)) {
      console.error("Failed to fetch messages:", messages);
      return;
    }

    // Filter to last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = messages
      .filter((m: any) => new Date(m.timestamp).getTime() >= cutoff)
      .reverse();

    let parsed = 0;
    let skipped = 0;
    for (const msg of recent) {
      if (isAlreadyProcessed(msg.id)) {
        skipped++;
        continue;
      }

      let lead = null;

      // Try plain text content
      if (msg.content?.includes("Stock Information Walmart")) {
        lead = parseTempoMessage(msg.content);
      }

      // Try forwarded message snapshots
      if (!lead && msg.message_snapshots?.length > 0) {
        for (const snap of msg.message_snapshots) {
          for (const embed of snap.message?.embeds ?? []) {
            lead = parseTempoEmbed(embed);
            if (lead) break;
          }
          if (lead) break;
        }
      }

      // Try regular embeds
      if (!lead && msg.embeds?.length > 0) {
        for (const embed of msg.embeds) {
          lead = parseTempoEmbed(embed);
          if (lead) break;
        }
      }

      if (lead) {
        try {
          ingestLead(lead);
          markProcessed(msg.id);
          parsed++;
        } catch (err) {
          console.error(`Failed to ingest message ${msg.id}:`, err);
        }
      }
    }

    console.log(`Startup scan: parsed ${parsed} new, skipped ${skipped} already processed, from ${recent.length} messages in #leads`);

    if (parsed > 0) {
      await postRouteUpdate(client, routeChannelId);
    }
  } catch (err) {
    console.error("Failed to scan existing leads:", err);
  }
}
