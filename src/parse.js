import NAMES from "./data/names.json";

export const RARITIES = ["C", "U", "R", "RR", "RRR", "AR", "SAR", "SR", "UR", "HR", "ACE", "PR"];
export const LANGS = [
  ["zh", "繁中"],
  ["ja", "日文"],
  ["en", "英文"],
];
const LANG_INDEX = { zh: 1, ja: 2, en: 3 };

export function parseCode(text) {
  const clean = text.replace(/[|lI]/g, "/").replace(/\s+/g, " ");
  const number = clean.match(/(\d{3})\s*\/\s*(\d{2,3})/) || clean.match(/(\d{1,3})\s*\/\s*(\d{2,3})/);
  const after = number ? clean.slice(number.index + number[0].length) : clean;
  const rarity = after.match(/\b(SAR|RRR|ACE|RR|AR|SR|UR|HR|PR|R|U|C)\b/);
  const set = clean.match(/\b([A-Z]{1,3}\d{1,2}[a-zA-Z]?)\b/);
  return {
    number: number ? number[1].padStart(3, "0") : "",
    total: number ? number[2] : "",
    rarity: rarity ? rarity[1] : "",
    setCode: set ? set[1] : "",
    full: Boolean(number && number[1].length === 3),
  };
}

const normalize = (s) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(vmax|vstar|v-union|gx|ex|break)$/i, "")
    .replace(/^(mega |m |超級|メガ)/, "")
    .replace(/[\s.・'’-]/g, "");

const bigrams = (s) => {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  if (s.length === 1) out.add(s);
  return out;
};

const dice = (a, b) => {
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size || 1);
};

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;

const overlap = (a, b) => {
  const pool = [...b];
  let hit = 0;
  for (const ch of a) {
    const i = pool.indexOf(ch);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return hit / Math.max(a.length, b.length);
};

const similarity = (token, key) => {
  if (token.includes(key)) return 1;
  const d = dice(token, key);
  return CJK.test(key) ? Math.max(d, overlap(token, key)) : d;
};

const INDEX = NAMES.map(([dex, zh, ja, en]) => ({ dex, zh, ja, en, keys: [normalize(zh), normalize(ja), normalize(en)] }));

export function matchName(text) {
  const tokens = text
    .normalize("NFKC")
    .replace(/([\u3040-\u30ff\u4e00-\u9fff])\s+(?=[\u3040-\u30ff\u4e00-\u9fff])/g, "$1")
    .split(/[\s\d|:：,，。.]+/)
    .map(normalize)
    .filter((t) => t.length >= 2);
  const top = new Map();
  for (const entry of INDEX) {
    entry.keys.forEach((key, i) => {
      if (!key) return;
      for (const [t, token] of tokens.entries()) {
        const score = similarity(token, key) - t * 0.01;
        const prev = top.get(entry.dex);
        if (!prev || score > prev.score) top.set(entry.dex, { entry, lang: ["zh", "ja", "en"][i], score });
      }
    });
  }
  const [best, second] = [...top.values()].sort((a, b) => b.score - a.score);
  if (!best || best.score < (best.lang === "en" ? 0.8 : 0.6)) return null;
  if (second && best.score - second.score < 0.05) return null;
  return { dex: best.entry.dex, lang: best.lang, name: best.entry[best.lang], score: best.score };
}

export function searchNames(query, lang) {
  const q = normalize(query);
  if (!q) return [];
  const i = LANG_INDEX[lang] || 1;
  const out = [];
  for (const row of NAMES) {
    const name = row[i];
    const n = normalize(name);
    if (n.startsWith(q)) out.push({ dex: row[0], name, rank: 0 });
    else if (n.includes(q)) out.push({ dex: row[0], name, rank: 1 });
    if (out.length > 40) break;
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, 6);
}

export const nameOfDex = (dex, lang) => {
  const row = NAMES.find((r) => r[0] === dex);
  return row ? row[LANG_INDEX[lang] || 1] : "";
};

export function missingNumbers(total, owned) {
  const have = new Set(owned);
  const ranges = [];
  let start = null;
  for (let n = 1; n <= total + 1; n++) {
    const missing = n <= total && !have.has(n);
    if (missing && start === null) start = n;
    if (!missing && start !== null) {
      ranges.push(start === n - 1 ? `${start}` : `${start}-${n - 1}`);
      start = null;
    }
  }
  return ranges;
}
