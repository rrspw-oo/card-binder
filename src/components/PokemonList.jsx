import { useMemo } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { RARITIES } from "../parse";
import Photo from "./Photo";
import PageHead from "./PageHead";

const rank = (card) => RARITIES.indexOf(card.rarity);

function PokemonList({ onBack, onOpen }) {
  const cards = useLive(() => db.cards.toArray(), []);
  const groups = useMemo(() => {
    const map = new Map();
    for (const c of cards || []) {
      const key = c.dex ? `d${c.dex}` : c.name ? `n${c.name}` : "";
      if (!key) continue;
      const g = map.get(key) || { key, dex: c.dex, name: c.name, count: 0, best: c };
      g.count += c.qty;
      if (rank(c) > rank(g.best)) g.best = c;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => (a.dex || 9999) - (b.dex || 9999) || a.name.localeCompare(b.name));
  }, [cards]);

  return (
    <div className="page">
      <PageHead back="收藏" onBack={onBack} title="寶可夢" />
      <section className="list-cover">
        <p className="eyebrow">收藏</p>
        <h2 className="list-title">{groups.length} 隻寶可夢</h2>
        <p className="list-sub">點一隻寶可夢，看你有的所有卡</p>
      </section>
      <div className="card-grid list-panel">
        {groups.map((g) => (
          <button key={g.key} type="button" className="grid-card" onClick={() => onOpen(g.best)}>
            <Photo blob={g.best.photo} className="card-img" alt={g.name} />
            <span className="grid-card-name">{g.name}</span>
            <span className="grid-card-meta">
              {g.dex ? `No.${String(g.dex).padStart(4, "0")}・` : ""}
              {g.count} 張
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default PokemonList;
