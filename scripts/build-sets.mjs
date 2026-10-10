import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/sets-zh.json");
const URL = "https://asia.pokemon-card.com/tw/card-search/";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

async function main() {
  const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Failed: ${URL}`);
  const html = await res.text();
  const sets = [...html.matchAll(/class="expansionCode" value="([^"]+)"\s*>\s*<label[^>]*>([^<]+)<\/label>/g)].map(([, code, label]) => {
    const name = decode(label);
    const inner = name.match(/「(.+?)」/);
    return [code, inner ? inner[1] + name.slice(name.indexOf("」") + 1).trim() : name];
  });
  if (sets.length < 50) throw new Error(`Only ${sets.length} sets found`);
  writeFileSync(OUT, JSON.stringify(sets));
  console.log(`sets ${sets.length}, newest ${sets[0].join(" ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
