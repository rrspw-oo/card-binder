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
  const open = (card) => onOpen(card, title, sorted);

  return (
    <div className="page">
      <PageHead back={backLabel} onBack={onBack} title={title} />
      {kind === "set" && first && (
        <section className="cover">
          <div className="cover-text">
            <h2 className="cover-code">{first.setCode}</h2>
            <p className="cover-name">
              {first.lang === "zh" && SET_NAMES[first.setCode] ? `${SET_NAMES[first.setCode]}・` : ""}
              {LANG_LABEL[first.lang]}
            </p>
            <dl className="cover-stats">
              <div>
                <dt>已收</dt>
                <dd>{total ? ownedCount : sorted.length}</dd>
              </div>
              {total > 0 && (
                <div>
                  <dt>還缺</dt>
                  <dd>{total - ownedCount}</dd>
                </div>
              )}
              <div>
                <dt>重複</dt>
                <dd>{copies - sorted.length}</dd>
              </div>
            </dl>
          </div>
          {total > 0 && (
            <svg className="ring" viewBox="0 0 64 64" aria-label={`已收 ${ownedCount} / ${total}`}>
              <circle cx="32" cy="32" r="27" className="ring-track" />
              <circle cx="32" cy="32" r="27" className="ring-fill" pathLength="100" strokeDasharray={`${Math.max(1, (ownedCount / total) * 100)} 100`} />
              <text x="32" y="33" className="ring-text">
                {Math.round((ownedCount / total) * 100)}%
              </text>
            </svg>
          )}
        </section>
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
