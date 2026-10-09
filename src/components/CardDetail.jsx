import { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS } from "../parse";
import Photo from "./Photo";

const LANG_LABEL = Object.fromEntries(LANGS);

function CardDetail({ id, onBack, backLabel, onEdit, onOpenPokemon, onOpenSet }) {
  const card = useLive(() => db.cards.get(id).then((c) => c || null), [id]);
  const [tag, setTag] = useState("");

  const left = useRef(false);

  useEffect(() => {
    if (card !== null || left.current) return;
    left.current = true;
    onBack();
  }, [card, onBack]);

  if (!card) return null;

  const setQty = (qty) => (qty < 1 ? null : db.cards.update(id, { qty }));
  const addTag = (e) => {
    e.preventDefault();
    const t = tag.trim();
    if (t && !card.tags.includes(t)) db.cards.update(id, { tags: [...card.tags, t] });
    setTag("");
  };
  const removeTag = (t) => db.cards.update(id, { tags: card.tags.filter((x) => x !== t) });
  const remove = () => {
    if (window.confirm("確定刪除這張卡片？")) db.cards.delete(id);
  };

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="text-button" onClick={onBack}>
          {backLabel}
        </button>
        <h1>{card.setCode} {card.number}</h1>
        <button type="button" className="text-button" onClick={() => onEdit(card)}>
          編輯
        </button>
      </header>
      <div className="detail">
        <Photo blob={card.photo} className="detail-photo" alt={card.name} />
        {card.name ? (
          <button type="button" className="detail-name" onClick={() => onOpenPokemon(card)}>
            {card.name}
          </button>
        ) : (
          <p className="detail-name muted">未填卡名</p>
        )}
        <dl className="meta">
          <dt>系列</dt>
          <dd>
            <button type="button" className="link" onClick={() => onOpenSet(card.setKey)}>
              {card.setCode}
            </button>
            ，{LANG_LABEL[card.lang]}
          </dd>
          <dt>卡號</dt>
          <dd>
            {card.number}
            {card.total ? ` / ${card.total}` : ""}
          </dd>
          <dt>稀有度</dt>
          <dd>{card.rarity || "未標示"}</dd>
          <dt>數量</dt>
          <dd className="stepper">
            <button type="button" aria-label="減少" onClick={() => setQty(card.qty - 1)} disabled={card.qty <= 1}>
              −
            </button>
            <span>{card.qty}</span>
            <button type="button" aria-label="增加" onClick={() => setQty(card.qty + 1)}>
              +
            </button>
          </dd>
        </dl>
        <section className="tags">
          <h2>標籤</h2>
          <div className="chips">
            {card.tags.map((t) => (
              <button key={t} type="button" className="chip is-on" onClick={() => removeTag(t)} aria-label={`移除標籤 ${t}`}>
                {t} ×
              </button>
            ))}
          </div>
          <form className="tag-form" onSubmit={addTag}>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="新增標籤，例如 交換用" />
            <button type="submit" className="button is-ghost">
              加入
            </button>
          </form>
        </section>
        <button type="button" className="text-button is-danger" onClick={remove}>
          刪除這張卡片
        </button>
      </div>
    </div>
  );
}

export default CardDetail;
