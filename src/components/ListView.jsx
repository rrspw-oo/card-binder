import { useMemo, useState } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, RARITIES, missingNumbers } from "../parse";
import BinderPages from "./BinderPages";

const LANG_LABEL = Object.fromEntries(LANGS);
const byNumber = (a, b) => (Number(a.number) || 0) - (Number(b.number) || 0) || a.number.localeCompare(b.number);

function query(kind, value) {
  if (kind === "set") return db.cards.where("setKey").equals(value).toArray();
  if (kind === "rarity") return db.cards.filter((c) => (c.rarity || "") === value).toArray();
  if (kind === "tag") return db.cards.where("tags").equals(value).toArray();
  if (kind === "dex") return db.cards.where("dex").equals(value.dex).toArray();
  return db.cards.filter((c) => c.name === value.name).toArray();
}

function titleOf(kind, value, cards) {
  if (kind === "set") return cards?.[0]?.setCode || "";
  if (kind === "rarity") return value || "未標示";
  if (kind === "tag") return value;
  return value.name;
}

function ListView({ kind, value, onBack, backLabel, onOpen }) {
  const cards = useLive(() => query(kind, value), [kind, JSON.stringify(value)]);
  const [rarity, setRarity] = useState(null);
  const sorted = useMemo(() => {
    if (!cards) return [];
    const list = kind === "set" ? [...cards].sort(byNumber) : [...cards].sort((a, b) => a.setCode.localeCompare(b.setCode) || byNumber(a, b));
    return rarity === null ? list : list.filter((c) => (c.rarity || "") === rarity);
  }, [cards, kind, rarity]);
  const rarities = useMemo(() => [...RARITIES, ""].filter((r) => cards?.some((c) => (c.rarity || "") === r)), [cards]);
  const total = kind === "set" ? Number(cards?.[0]?.total) || 0 : 0;
  const owned = cards?.map((c) => Number(c.number)).filter((n) => n && n <= total) || [];
  const missing = total ? missingNumbers(total, owned) : [];
  const ownedCount = new Set(owned).size;
  const slots = useMemo(() => {
    if (kind === "set" && total && rarity === null) {
      const byNo = new Map(sorted.map((c) => [Number(c.number), c]));
      const fixed = Array.from({ length: total }, (_, i) => ({ key: `n${i + 1}`, label: String(i + 1).padStart(3, "0"), card: byNo.get(i + 1) || null }));
      const extra = sorted.filter((c) => !(Number(c.number) >= 1 && Number(c.number) <= total)).map((c) => ({ key: `c${c.id}`, label: c.number, card: c }));
      return [...fixed, ...extra];
    }
    return sorted.map((c) => ({ key: `c${c.id}`, label: c.number, card: c }));
  }, [kind, total, rarity, sorted]);

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="text-button" onClick={onBack}>
          {backLabel}
        </button>
        <h1>{titleOf(kind, value, cards)}</h1>
        <span />
      </header>
      {kind === "set" && cards?.[0] && (
        <p className="summary muted">
          {LANG_LABEL[cards[0].lang]}
          {total ? `，已收 ${ownedCount} / ${total}` : ""}
        </p>
      )}
      {kind !== "rarity" && rarities.length > 1 && (
        <div className="chips">
          <button type="button" className={rarity === null ? "chip is-on" : "chip"} onClick={() => setRarity(null)}>
            全部
          </button>
          {rarities.map((r) => (
            <button key={r || "none"} type="button" className={rarity === r ? "chip is-on" : "chip"} onClick={() => setRarity(r)}>
              {r || "未標示"}
            </button>
          ))}
        </div>
      )}
      <BinderPages slots={slots} onOpen={onOpen} />
      {missing.length > 0 && rarity === null && (
        <section className="missing">
          <h2>還缺 {total - ownedCount} 張</h2>
          <p className="muted">{missing.join("、")}</p>
        </section>
      )}
    </div>
  );
}

export default ListView;
