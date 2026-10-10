import { useMemo, useRef, useState } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, RARITIES, SET_NAMES } from "../parse";
import Photo from "./Photo";
import Icon from "./Icon";

const LANG_LABEL = Object.fromEntries(LANGS);

const rank = (card) => RARITIES.indexOf(card.rarity);
const better = (a, b) => rank(b) - rank(a) || Number(a.number) - Number(b.number);

function groupSets(cards) {
  const map = new Map();
  for (const card of cards) {
    const g = map.get(card.setKey) || { key: card.setKey, setCode: card.setCode, lang: card.lang, total: Number(card.total) || 0, numbers: new Set(), kinds: 0, last: 0, cards: [] };
    const n = Number(card.number);
    if (n && (!g.total || n <= g.total)) g.numbers.add(n);
    g.kinds += 1;
    g.last = Math.max(g.last, card.createdAt);
    g.cards.push(card);
    map.set(card.setKey, g);
  }
  return [...map.values()].map((g) => ({ ...g, fan: [...g.cards].sort(better).slice(0, 3) })).sort((a, b) => b.last - a.last);
}

const pokemonKey = (c) => (c.dex ? `d${c.dex}` : c.name ? `n${c.name}` : "");

function matches(card, q) {
  const s = q.toLowerCase();
  return (
    (card.name || "").toLowerCase().includes(s) ||
    card.setCode.toLowerCase().startsWith(s) ||
    (/^\d+$/.test(s) && Number(card.number) === Number(s)) ||
    `${card.setCode} ${card.number}`.toLowerCase().includes(s) ||
    (card.tags || []).some((t) => t.toLowerCase().includes(s))
  );
}

function useDragScroll() {
  const ref = useRef(null);
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      ref.current.classList.add("is-dragging");
    }
    if (d.moved) ref.current.scrollLeft = d.left - dx;
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    ref.current.classList.remove("is-dragging");
    const swallow = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    ref.current.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => ref.current?.removeEventListener("click", swallow, { capture: true }), 0);
  };
  return { ref, onPointerDown, onPointerMove, onPointerUp: end, onPointerLeave: end };
}

function Binder({ onOpenSet, onOpenRarity, onOpenTag, onOpenCard, onOpenPokemon, onScan, onBackup }) {
  const cards = useLive(() => db.cards.toArray(), []);
  const [q, setQ] = useState("");
  const railDrag = useDragScroll();
  const sets = useMemo(() => (cards ? groupSets(cards) : []), [cards]);
  const stats = useMemo(() => {
    const list = cards || [];
    return {
      copies: list.reduce((sum, c) => sum + c.qty, 0),
      pokemon: new Set(list.map(pokemonKey).filter(Boolean)).size,
      sets: new Set(list.map((c) => c.setKey)).size,
    };
  }, [cards]);
  const recent = useMemo(() => [...(cards || [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12), [cards]);
  const rarities = useMemo(() => {
    const count = {};
    for (const c of cards || []) if (c.rarity) count[c.rarity] = (count[c.rarity] || 0) + c.qty;
    return [...RARITIES].reverse().filter((r) => count[r]).map((r) => [r, count[r]]);
  }, [cards]);
  const tags = useMemo(() => {
    const count = {};
    for (const c of cards || []) for (const t of c.tags || []) count[t] = (count[t] || 0) + c.qty;
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [cards]);
  const query = q.trim();
  const results = useMemo(() => (query && cards ? cards.filter((c) => matches(c, query)).sort(better) : []), [cards, query]);

  if (!cards) return <div className="page" />;

  return (
    <div className="page home">
      <header className="home-head">
        <h1>我的收藏</h1>
        <button type="button" className="round-button" onClick={onBackup}>
          備份
        </button>
      </header>

      {cards.length === 0 ? (
        <div className="welcome">
          <div className="welcome-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>開始你的卡冊</h2>
        </div>
      ) : (
        <>
          <section className="hero">
            <p className="eyebrow">收藏總覽</p>
            <div className="stats">
            <div>
              <strong>{stats.copies}</strong>
              <span>張卡</span>
            </div>
            <button type="button" onClick={onOpenPokemon}>
              <strong>{stats.pokemon}</strong>
              <span>隻寶可夢</span>
            </button>
            <div>
              <strong>{stats.sets}</strong>
              <span>個系列</span>
            </div>
            </div>
          </section>

          <label className="search">
            <Icon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋卡名、卡號、系列或標籤" enterKeyHint="search" />
            {q && (
              <button type="button" className="search-clear" onClick={() => setQ("")} aria-label="清除">
                <Icon name="close" size={16} />
              </button>
            )}
          </label>

          {!query && (rarities.length > 0 || tags.length > 0) && (
            <div className="home-pills">
              {rarities.map(([r, n]) => (
                <button key={r} type="button" className="pill" onClick={() => onOpenRarity(r)}>
                  {r}
                  <span>{n}</span>
                </button>
              ))}
              {tags.map(([t, n]) => (
                <button key={t} type="button" className="pill is-tag" onClick={() => onOpenTag(t)}>
                  {t}
                  <span>{n}</span>
                </button>
              ))}
            </div>
          )}

          {query ? (
            <section className="section panel home-fill">
              <div className="panel-head">
                <h2 className="section-title">{results.length ? `找到 ${results.length} 張` : "沒有符合的卡片"}</h2>
              </div>
              <div className="card-grid home-scroll">
                {results.map((c) => (
                  <button key={c.id} type="button" className="grid-card" onClick={() => onOpenCard(c, results)}>
                    <Photo blob={c.photo} className="card-img" alt={c.name} />
                    <span className="grid-card-name">{c.name || "未填卡名"}</span>
                    <span className="grid-card-meta">
                      {c.setCode} {c.number}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="section panel">
                <div className="panel-head">
                  <h2 className="section-title">最近收進</h2>
                  <span className="panel-meta">{recent.length} 張</span>
                </div>
                <div className="rail" {...railDrag}>
                  {recent.map((c) => (
                    <button key={c.id} type="button" className="rail-card" onClick={() => onOpenCard(c, recent)}>
                      <Photo blob={c.photo} className="card-img" alt={c.name} />
                      <span className="rail-name">{c.name || `${c.setCode} ${c.number}`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="section panel home-fill">
                <div className="panel-head">
                  <h2 className="section-title">卡冊</h2>
                  <span className="panel-meta">{sets.length} 本</span>
                </div>
                <ul className="albums home-scroll">
                  {sets.map((g) => (
                    <li key={g.key}>
                      <button type="button" className="album" onClick={() => onOpenSet(g.key)}>
                        <span className="book" aria-hidden="true">
                          <span className="book-pages" />
                          <span className="book-cover">
                            <span className="book-window">
                              <Photo blob={g.fan[0].photo} className="card-img" />
                            </span>
                            <span className="book-title">{g.setCode}</span>
                          </span>
                        </span>
                        <span className="album-info">
                          <span className="album-code">
                            {g.setCode}
                            <small>{LANG_LABEL[g.lang]}</small>
                          </span>
                          {g.lang === "zh" && SET_NAMES[g.setCode] && <span className="album-name">{SET_NAMES[g.setCode]}</span>}
                          {g.total > 0 ? (
                            <>
                              <span className="progress">
                                <span style={{ width: `${Math.max(2, Math.min(100, (g.numbers.size / g.total) * 100))}%` }} />
                              </span>
                              <span className="album-count">
                                <strong>{g.numbers.size}</strong> / {g.total}
                              </span>
                            </>
                          ) : (
                            <span className="album-count">{g.kinds} 種</span>
                          )}
                        </span>
                        <Icon name="forward" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

            </>
          )}
        </>
      )}

      <div className="dock">
        <button type="button" className="scan-button" onClick={onScan}>
          <Icon name="camera" />
          掃描卡片
        </button>
      </div>
    </div>
  );
}

export default Binder;
