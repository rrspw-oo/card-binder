import { useMemo } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, RARITIES } from "../parse";
import Photo from "./Photo";

const LANG_LABEL = Object.fromEntries(LANGS);
const TABS = [
  ["sets", "系列"],
  ["rarity", "稀有度"],
  ["tags", "自訂"],
];

const rank = (card) => RARITIES.indexOf(card.rarity);

function groupSets(cards) {
  const map = new Map();
  for (const card of cards) {
    const g = map.get(card.setKey) || { key: card.setKey, setCode: card.setCode, lang: card.lang, total: Number(card.total) || 0, numbers: new Set(), copies: 0, kinds: 0, last: 0, cover: card };
    const n = Number(card.number);
    if (n && (!g.total || n <= g.total)) g.numbers.add(n);
    g.copies += card.qty;
    g.kinds += 1;
    g.last = Math.max(g.last, card.createdAt);
    if (rank(card) > rank(g.cover) || (rank(card) === rank(g.cover) && Number(card.number) < Number(g.cover.number))) g.cover = card;
    map.set(card.setKey, g);
  }
  return [...map.values()].sort((a, b) => b.last - a.last);
}

function Binder({ tab, onTab, onOpenSet, onOpenRarity, onOpenTag, onScan, onBackup }) {
  const cards = useLive(() => db.cards.toArray(), []);
  const sets = useMemo(() => (cards ? groupSets(cards) : []), [cards]);
  const rarities = useMemo(() => {
    const count = {};
    for (const c of cards || []) count[c.rarity || ""] = (count[c.rarity || ""] || 0) + c.qty;
    return [...RARITIES, ""].filter((r) => count[r]).map((r) => [r, count[r]]);
  }, [cards]);
  const tags = useMemo(() => {
    const count = {};
    for (const c of cards || []) for (const t of c.tags || []) count[t] = (count[t] || 0) + c.qty;
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [cards]);
  const totalCopies = (cards || []).reduce((sum, c) => sum + c.qty, 0);

  return (
    <div className="page">
      <header className="page-head">
        <span />
        <h1>卡冊</h1>
        <button type="button" className="text-button" onClick={onBackup}>
          備份
        </button>
      </header>
      {cards && (
        <p className="summary muted">
          {cards.length} 種卡，共 {totalCopies} 張
        </p>
      )}
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => onTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {cards && cards.length === 0 && <p className="empty">還沒有卡片，按下方「掃描」開始建立卡冊</p>}
      {tab === "sets" && (
        <ul className="shelf">
          {sets.map((g) => (
            <li key={g.key}>
              <button type="button" className="cover" onClick={() => onOpenSet(g.key)}>
                <span className="cover-art">
                  <Photo blob={g.cover.photo} alt={g.setCode} />
                </span>
                <span className="cover-title">
                  <strong>{g.setCode}</strong>
                  <span className="muted">{LANG_LABEL[g.lang]}</span>
                </span>
                <span className="cover-meta muted">
                  {g.total ? `${g.numbers.size} / ${g.total}` : `${g.kinds} 種`}
                  {g.copies > g.kinds ? `，重複 ${g.copies - g.kinds}` : ""}
                </span>
                {g.total > 0 && (
                  <span className="bar">
                    <span style={{ width: `${Math.min(100, (g.numbers.size / g.total) * 100)}%` }} />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === "rarity" && (
        <ul className="rows">
          {rarities.map(([r, n]) => (
            <li key={r || "none"}>
              <button type="button" className="row" onClick={() => onOpenRarity(r)}>
                <span className="row-main">
                  <strong>{r || "未標示"}</strong>
                </span>
                <span className="row-side">{n} 張</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === "tags" && (
        <>
          {tags.length === 0 && cards?.length > 0 && <p className="empty">在卡片頁加上標籤，例如「交換用」「想賣」，就會出現在這裡</p>}
          <ul className="rows">
            {tags.map(([t, n]) => (
              <li key={t}>
                <button type="button" className="row" onClick={() => onOpenTag(t)}>
                  <span className="row-main">
                    <strong>{t}</strong>
                  </span>
                  <span className="row-side">{n} 張</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <footer className="page-foot is-floating">
        <button type="button" className="button is-scan" onClick={onScan}>
          掃描
        </button>
      </footer>
    </div>
  );
}

export default Binder;
