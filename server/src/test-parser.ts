import { parseTempoMessage } from "./services/tempo-parser.js";

const sampleMessage = `Stock Information Walmart
CoComelon Musical Glow Light up JJ Plush – Nighttime Snuggle up 10-Inch Plush Toddler Toys for Kids (MSRP: $19.97)
Listed below are only the stores with available stock within a 50 mile radius.The stores with the lowest price will be highlighted by the :fire:
Store #4068 - Spanish Fork, UT
Store: $5.0
Sales Floor: 0
Back Room: 1
Distance: 12.07mi
Address: 1206 N Canyon Creek Pkwy, 84660
Store #5235 - Sandy, UT
Store: $5.0
Sales Floor: 13
Back Room: 0
Aisles: G32-5
Distance: 22.33mi
Address: 9151 S Quarry Bend Dr, 84094
Store #3232 - West Jordan, UT
Store: $4.5 :fire:
Sales Floor: 4
Back Room: 0
Distance: 27.17mi
Address: 7671 S 3800 W, 84084
Store #1686 - Taylorsville, UT
Store: $5.0
Sales Floor: 5
Back Room: 0
Distance: 28.23mi
Address: 5469 S Redwood Rd, 84123
Store #5233 - West Valley City, UT
Store: $5.0
Sales Floor: 5
Back Room: 0
Distance: 30.06mi
Address: 5675 W 6200 S, 84118
Store #3589 - Salt Lake City, UT
Store: $6.0
Sales Floor: 5
Back Room: 0
Aisles: L4-8
Distance: 33.03mi
Address: 350 Hope Ave, 84115
Store #3366 - Centerville, UT
Store: $11.0
Sales Floor: 39
Back Room: 0
Distance: 44.45mi
Address: 221 W Parrish Ln, 84014
SKU (UPC)
484390208 (191726463634)
MSRP
$19.97
Lowest Price
$4.5
Checked ZIP
84097
Image
The Buy Box Assistant • Walmart • Powered by TempoMonitors.com`;

const result = parseTempoMessage(sampleMessage);

if (!result) {
  console.error("FAILED: Parser returned null");
  process.exit(1);
}

console.log("Product:", result.productName);
console.log("MSRP:", result.msrp);
console.log("SKU:", result.sku, "UPC:", result.upc);
console.log("Lowest Price:", result.lowestPrice);
console.log("Checked ZIP:", result.checkedZip);
console.log(`Stores found: ${result.stores.length}\n`);

for (const store of result.stores) {
  console.log(`  Store #${store.storeNumber} - ${store.city}, ${store.state}`);
  console.log(`    Price: $${store.storePrice}${store.isLowestPrice ? " 🔥" : ""}`);
  console.log(`    Floor: ${store.floorQty} | Back: ${store.backroomQty}${store.aisle ? ` | Aisle: ${store.aisle}` : ""}`);
  console.log(`    Distance: ${store.distanceMiles}mi`);
  console.log(`    Address: ${store.address}, ${store.zip}`);
  console.log();
}

// Verify all fields
const checks = [
  ["Product name", result.productName.includes("CoComelon")],
  ["MSRP", result.msrp === 19.97],
  ["7 stores", result.stores.length === 7],
  ["SKU", result.sku === "484390208"],
  ["UPC", result.upc === "191726463634"],
  ["Lowest price", result.lowestPrice === 4.5],
  ["Checked ZIP", result.checkedZip === "84097"],
  ["Fire emoji store", result.stores.some((s) => s.isLowestPrice && s.storeNumber === 3232)],
  ["Aisle parsed", result.stores.some((s) => s.aisle === "G32-5")],
] as const;

console.log("--- Verification ---");
let allPassed = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "✅" : "❌"} ${name}`);
  if (!pass) allPassed = false;
}

if (allPassed) {
  console.log("\nAll checks passed!");
} else {
  console.log("\nSome checks failed!");
  process.exit(1);
}
