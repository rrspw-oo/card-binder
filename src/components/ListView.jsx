import { useMemo } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, SET_NAMES } from "../parse";
import BinderPages from "./BinderPages";
import PageHead from "./PageHead";
import Photo from "./Photo";

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
  const sorted = useMemo(() => {
    if (!cards) return [];
    return kind === "set" ? [...cards].sort(byNumber) : [...cards].sort((a, b) => a.setCode.localeCompare(b.setCode) || byNumber(a, b));
  }, [cards, kind]);
  const total = kind === "set" ? Number(cards?.[0]?.total) || 0 : 0;
  const ownedCount = new Set(sorted.map((c) => Number(c.number)).filter((n) => n && n <= total)).size;
  const slots = useMemo(() => {
    if (!total) return sorted.map((c) => ({ key: `c${c.id}`, label: c.number, card: c }));
    const byNo = new Map(sorted.map((c) => [Number(c.number), c]));
    const fixed = Array.from({ length: total }, (_, i) => ({ key: `n${i + 1}`, label: String(i + 1).padStart(3, "0"), card: byNo.get(i + 1) || null }));
    const extra = sorted.filter((c) => !(Number(c.number) >= 1 && Number(c.number) <= total)).map((c) => ({ key: `c${c.id}`, label: c.number, card: c }));
    return [...fixed, ...extra];
  }, [total, sorted]);
  const newest = slots.reduce((best, slot, i) => (slot.card && (best < 0 || slot.card.createdAt > slots[best].card.createdAt) ? i : best), -1);
  const copies = sorted.reduce((sum, c) => sum + c.qty, 0);
  const first = cards?.[0];
  const title = titleOf(kind, value, cards);
  const open = (card) => onOpen(card, title);

  return (
    <div className="page">
      <PageHead back={backLabel} onBack={onBack} title={title} />
      {kind === "set" && first && (
        <div className="set-head">
          <p className="lead">
            {first.lang === "zh" && SET_NAMES[first.setCode] ? `${SET_NAMES[first.setCode]}・` : ""}
            {LANG_LABEL[first.lang]}
          </p>
          {total > 0 && (
            <div className="set-progress">
              <span className="progress">
                <span style={{ width: `${Math.max(2, Math.min(100, (ownedCount / total) * 100))}%` }} />
              </span>
              <span>
                已收 <strong>{ownedCount}</strong> / {total}
              </span>
            </div>
          )}
        </div>
      )}
      {kind === "set" ? (
        <BinderPages slots={slots} start={newest} onOpen={open} />
      ) : (
        <>
          <p className="lead">{copies} 張</p>
          <div className="card-grid">
            {sorted.map((c) => (
              <button key={c.id} type="button" className="grid-card" onClick={() => open(c)}>
                <Photo blob={c.photo} className="card-img" alt={c.name} />
                <span className="grid-card-name">{c.name || "未填卡名"}</span>
                <span className="grid-card-meta">
                  {c.setCode} {c.number}
                  {c.qty > 1 ? `・${c.qty} 張` : ""}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ListView;
