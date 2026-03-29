export interface ParsedStore {
  storeNumber: number;
  city: string;
  state: string;
  storePrice: number;
  floorQty: number;
  backroomQty: number;
  aisle: string | null;
  distanceMiles: number;
  address: string;
  zip: string;
  isLowestPrice: boolean;
}

export interface ParsedLead {
  productName: string;
  msrp: number;
  sku: string | null;
  upc: string | null;
  lowestPrice: number | null;
  checkedZip: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  stores: ParsedStore[];
}

// Parse from Discord embed object (forwarded Tempo messages)
export function parseTempoEmbed(embed: {
  title?: string;
  url?: string;
  author?: { name?: string };
  fields?: Array<{ name: string; value: string }>;
  thumbnail?: { url?: string };
}): ParsedLead | null {
  if (embed.author?.name !== "Stock Information Walmart" && !embed.title?.includes("MSRP:")) {
    return null;
  }

  // Title: "Product Name (MSRP: $XX.XX)"
  const titleMatch = embed.title?.match(/^(.+?)\s*\(MSRP:\s*\$?([\d.]+)\)/);
  if (!titleMatch) return null;

  const productName = titleMatch[1].trim();
  const msrp = parseFloat(titleMatch[2]);
  const productUrl = embed.url ?? null;
  const imageUrl = embed.thumbnail?.url ?? null;
  let sku: string | null = null;
  let upc: string | null = null;
  let lowestPrice: number | null = null;
  let checkedZip: string | null = null;
  const stores: ParsedStore[] = [];

  for (const field of embed.fields ?? []) {
    // Store fields: "Store #NNNN - City, ST"
    const storeMatch = field.name.match(/^Store\s*#(\d+)\s*-\s*(.+),\s*(\w{2})$/);
    if (storeMatch) {
      const storeNumber = parseInt(storeMatch[1]);
      const city = storeMatch[2].trim();
      const state = storeMatch[3];

      const lines = field.value.split("\n");
      let storePrice = 0;
      let floorQty = 0;
      let backroomQty = 0;
      let aisle: string | null = null;
      let distanceMiles = 0;
      let address = "";
      let zip = "";
      let isLowestPrice = false;

      for (const line of lines) {
        const priceMatch = line.match(/^Store:\s*\$?([\d.]+)\s*(:fire:|🔥)?/);
        if (priceMatch) {
          storePrice = parseFloat(priceMatch[1]);
          isLowestPrice = !!priceMatch[2];
          continue;
        }

        const floorMatch = line.match(/^Sales Floor:\s*(\d+)/);
        if (floorMatch) { floorQty = parseInt(floorMatch[1]); continue; }

        const backMatch = line.match(/^Back Room:\s*(\d+)/);
        if (backMatch) { backroomQty = parseInt(backMatch[1]); continue; }

        const aisleMatch = line.match(/^Aisles?:\s*(.+)/);
        if (aisleMatch) { aisle = aisleMatch[1].trim(); continue; }

        const distMatch = line.match(/^Distance:\s*([\d.]+)mi/);
        if (distMatch) { distanceMiles = parseFloat(distMatch[1]); continue; }

        // Address field may contain markdown link: [123 Main St, 84660](https://...)
        const addrLinkMatch = line.match(/^Address:\s*\[(.+?),?\s*(\d{5})\]/);
        if (addrLinkMatch) {
          address = addrLinkMatch[1].replace(/,\s*$/, "").trim();
          zip = addrLinkMatch[2];
          continue;
        }
        // Plain address fallback
        const addrMatch = line.match(/^Address:\s*(.+?),?\s*(\d{5})/);
        if (addrMatch) {
          address = addrMatch[1].replace(/,\s*$/, "").trim();
          zip = addrMatch[2];
          continue;
        }
      }

      if (storePrice > 0) {
        stores.push({ storeNumber, city, state, storePrice, floorQty, backroomQty, aisle, distanceMiles, address, zip, isLowestPrice });
      }
      continue;
    }

    // Footer fields
    if (field.name === "SKU (UPC)") {
      const skuMatch = field.value.match(/(\d+)\s*\((\d+)\)/);
      if (skuMatch) { sku = skuMatch[1]; upc = skuMatch[2]; }
    }
    if (field.name === "Lowest Price") {
      const m = field.value.match(/\$?([\d.]+)/);
      if (m) lowestPrice = parseFloat(m[1]);
    }
    if (field.name === "Checked ZIP") {
      const m = field.value.match(/(\d{5})/);
      if (m) checkedZip = m[1];
    }
  }

  if (!productName || !msrp || stores.length === 0) return null;

  return { productName, msrp, sku, upc, lowestPrice, checkedZip, productUrl: productUrl ?? null, imageUrl: imageUrl ?? null, stores };
}

// Parse from plain text (copy-pasted Tempo messages)
export function parseTempoMessage(text: string): ParsedLead | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (!lines.some((l) => l.includes("Stock Information Walmart"))) {
    return null;
  }

  let productName = "";
  let msrp = 0;
  let sku: string | null = null;
  let upc: string | null = null;
  let lowestPrice: number | null = null;
  let checkedZip: string | null = null;
  let productUrl: string | null = null;
  let imageUrl: string | null = null;
  const stores: ParsedStore[] = [];

  // Find product line — contains MSRP in parentheses
  for (const line of lines) {
    const msrpMatch = line.match(/^(.+?)\s*\(MSRP:\s*\$?([\d.]+)\)/);
    if (msrpMatch) {
      productName = msrpMatch[1].trim();
      msrp = parseFloat(msrpMatch[2]);
      break;
    }
  }

  if (!productName || !msrp) return null;

  // Parse stores — each block starts with "Store #NNNN - City, ST"
  let i = 0;
  while (i < lines.length) {
    const storeMatch = lines[i].match(/^Store\s*#(\d+)\s*-\s*(.+),\s*(\w{2})$/);
    if (storeMatch) {
      const storeNumber = parseInt(storeMatch[1]);
      const city = storeMatch[2].trim();
      const state = storeMatch[3];

      let storePrice = 0;
      let floorQty = 0;
      let backroomQty = 0;
      let aisle: string | null = null;
      let distanceMiles = 0;
      let address = "";
      let zip = "";
      let isLowestPrice = false;

      // Read subsequent lines for this store's data
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const line = lines[j];

        // Stop if we hit the next store or footer section
        if (line.match(/^Store\s*#\d+/) || line.startsWith("SKU") || line.startsWith("MSRP") || line.startsWith("Lowest")) {
          break;
        }

        const priceMatch = line.match(/^Store:\s*\$?([\d.]+)\s*(:fire:|🔥)?/);
        if (priceMatch) {
          storePrice = parseFloat(priceMatch[1]);
          isLowestPrice = !!priceMatch[2];
          continue;
        }

        const floorMatch = line.match(/^Sales Floor:\s*(\d+)/);
        if (floorMatch) {
          floorQty = parseInt(floorMatch[1]);
          continue;
        }

        const backMatch = line.match(/^Back Room:\s*(\d+)/);
        if (backMatch) {
          backroomQty = parseInt(backMatch[1]);
          continue;
        }

        const aisleMatch = line.match(/^Aisles?:\s*(.+)/);
        if (aisleMatch) {
          aisle = aisleMatch[1].trim();
          continue;
        }

        const distMatch = line.match(/^Distance:\s*([\d.]+)mi/);
        if (distMatch) {
          distanceMiles = parseFloat(distMatch[1]);
          continue;
        }

        const addrMatch = line.match(/^Address:\s*(.+?),?\s*(\d{5})/);
        if (addrMatch) {
          address = addrMatch[1].replace(/,\s*$/, "").trim();
          zip = addrMatch[2];
          continue;
        }
      }

      if (storePrice > 0) {
        stores.push({
          storeNumber,
          city,
          state,
          storePrice,
          floorQty,
          backroomQty,
          aisle,
          distanceMiles,
          address,
          zip,
          isLowestPrice,
        });
      }
    }

    // Footer parsing
    const skuLine = lines[i].match(/^(\d+)\s*\((\d+)\)/);
    if (skuLine && lines[i - 1]?.includes("SKU")) {
      sku = skuLine[1];
      upc = skuLine[2];
    }

    if (lines[i].startsWith("SKU (UPC)")) {
      // Next line has the actual values
      const nextLine = lines[i + 1];
      if (nextLine) {
        const skuMatch = nextLine.match(/^(\d+)\s*\((\d+)\)/);
        if (skuMatch) {
          sku = skuMatch[1];
          upc = skuMatch[2];
        }
      }
    }

    const lowestMatch = lines[i].match(/^Lowest Price\s*\$?([\d.]+)/);
    if (lowestMatch) {
      lowestPrice = parseFloat(lowestMatch[1]);
    }

    // Handle "Lowest Price" on one line, value on next
    if (lines[i] === "Lowest Price" && lines[i + 1]) {
      const valMatch = lines[i + 1].match(/^\$?([\d.]+)/);
      if (valMatch) lowestPrice = parseFloat(valMatch[1]);
    }

    const zipMatch = lines[i].match(/^Checked ZIP\s*(\d{5})/);
    if (zipMatch) {
      checkedZip = zipMatch[1];
    }

    // Handle "Checked ZIP" on one line, value on next
    if (lines[i] === "Checked ZIP" && lines[i + 1]) {
      const valMatch = lines[i + 1].match(/^(\d{5})/);
      if (valMatch) checkedZip = valMatch[1];
    }

    i++;
  }

  return {
    productName,
    msrp,
    sku,
    upc,
    lowestPrice,
    checkedZip,
    stores,
  };
}
