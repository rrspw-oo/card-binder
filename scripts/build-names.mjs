import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, "../node_modules/.cache/names");
const OUT = resolve(__dirname, "../src/data/names.json");
const CSV_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv";
const LANG = { 1: "ja", 4: "zh", 9: "en" };

async function load() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, "pokemon_species_names.csv");
  if (process.argv.includes("--refresh") || !existsSync(file)) {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Failed: ${CSV_URL}`);
    writeFileSync(file, await res.text());
  }
  return readFileSync(file, "utf8");
}

async function main() {
  const rows = (await load()).trim().split("\n").slice(1);
  const byDex = new Map();
  for (const row of rows) {
    const [dex, lang, name] = row.split(",");
    const key = LANG[lang];
    if (!key) continue;
    const entry = byDex.get(Number(dex)) || {};
    entry[key] = name;
    byDex.set(Number(dex), entry);
  }
  const names = [...byDex.entries()]
    .filter(([dex]) => dex <= 1025)
    .sort((a, b) => a[0] - b[0])
    .map(([dex, n]) => [dex, n.zh || "", n.ja || "", n.en || ""]);
  writeFileSync(OUT, JSON.stringify(names));
  console.log(`names ${names.length}, missing zh ${names.filter((n) => !n[1]).length}, ja ${names.filter((n) => !n[2]).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
