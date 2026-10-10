import NAMES from "./data/names.json";
import SETS_ZH from "./data/sets-zh.json";

export const RARITIES = ["C", "U", "R", "RR", "RRR", "AR", "SAR", "SR", "UR", "HR", "ACE", "PR"];
export const LANGS = [
  ["zh", "繁中"],
  ["ja", "日文"],
  ["en", "英文"],
];
const LANG_INDEX = { zh: 1, ja: 2, en: 3 };

export function parseCode(text) {
  let best = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/[|lI]/g, "/").replace(/\s+/g, " ");
    const number = line.match(/(\d{3})\s*\/\s*(\d{2,3})/) || line.match(/(\d{1,3})\s*\/\s*(\d{2,3})/);
    if (!number) continue;
    const full = number[1].length === 3;
    if (best && (best.full || !full)) continue;
    const after = line.slice(number.index + number[0].length, number.index + number[0].length + 8);
    const rarity = after.match(/^\s*(SAR|RRR|ACE|RR|AR|SR|UR|HR|PR|R|U|C)\b/);
    best = { number: number[1].padStart(3, "0"), total: number[2], rarity: rarity ? rarity[1] : "", full };
  }
  return best || { number: "", total: "", rarity: "", full: false };
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

const DIGIT_LOOKALIKE = { b: "6", G: "6", O: "0", o: "0", D: "0", Q: "0", l: "1", I: "1", i: "1", S: "5", s: "5", Z: "2", z: "2", B: "8", g: "9", q: "9" };

const normalizeSetCode = (raw) => {
  const m = raw.match(/^([A-Z]{1,3})(.*)$/);
  if (!m) return raw;
  let rest = m[2];
  let digits = "";
  while (rest && (/\d/.test(rest[0]) || (DIGIT_LOOKALIKE[rest[0]] && rest.length > 1))) {
    digits += /\d/.test(rest[0]) ? rest[0] : DIGIT_LOOKALIKE[rest[0]];
    rest = rest.slice(1);
  }
  return `${m[1]}${digits}${rest}`;
};

export const SET_NAMES = Object.fromEntries(SETS_ZH);
export const RECENT_SETS = SETS_ZH.slice(0, 4).map(([code]) => code);

const lookalike = (s) => [...s].map((c) => (/[A-Za-z]/.test(c) && DIGIT_LOOKALIKE[c] ? DIGIT_LOOKALIKE[c] : c)).join("").toLowerCase();

export function parseSetCode(text, known = []) {
  const none = { code: "", candidates: [] };
  const line = text.split("\n").find((l) => /\d{1,3}\s*\/\s*\d{2,3}/.test(l));
  if (!line) return none;
  const before = line.slice(0, line.search(/\d{1,3}\s*\/\s*\d{2,3}/)).replace(/[^A-Za-z0-9]/g, "");
  let core = before.replace(/^[D-J](?=[A-Za-z0-9]{2})/, "").replace(/[A-Z]$/, "");
  if (core.length >= 3 && /^[a-z]/.test(core) && !DIGIT_LOOKALIKE[core[0]]) core = core[0].toUpperCase() + core.slice(1);
  if (!core) return none;
  const guess = normalizeSetCode(core);
  const pool = [...new Set([...known, ...SETS_ZH.map(([code]) => code)])];
  const exact = pool.find((k) => lookalike(k) === lookalike(guess));
  if (exact) return { code: exact, candidates: [] };
  const tail = lookalike(guess).slice(-2);
  const byTail = tail.length === 2 && /[a-z]$/.test(guess) ? pool.filter((k) => lookalike(k).endsWith(tail)) : [];
  if (byTail.length) return { code: byTail[0], candidates: byTail.slice(1, 4) };
  return { code: /^[A-Z]{1,3}\d{1,2}[a-z]?$/.test(guess) ? guess : "", candidates: [] };
}

export function parseDex(text) {
  const m = text.normalize("NFKC").match(/N[o0O]\s*[.,:]?\s*(\d{3,4})\b/);
  const dex = m ? Number(m[1]) : 0;
  return dex >= 1 && dex <= NAMES.length ? dex : null;
}

export function detectLang(text) {
  if (/[\u3040-\u309f\u30a0-\u30ff]{2,}/.test(text)) return "ja";
  if ((text.match(/[\u4e00-\u9fff]/g) || []).length >= 4) return "zh";
  if ((text.match(/[A-Za-z]{3,}/g) || []).length >= 4) return "en";
  return null;
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
