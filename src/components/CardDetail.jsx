import { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, SET_NAMES, isPremium } from "../parse";
import TiltCard from "./TiltCard";
import PageHead from "./PageHead";
import Icon from "./Icon";

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
      <PageHead
        back={backLabel}
        onBack={onBack}
        title=""
        right={
          <button type="button" className="head-action" onClick={() => onEdit(card)}>
            編輯
          </button>
        }
      />
      <div className="detail">
        <article className={isPremium(card.rarity) ? "slab is-premium" : "slab"}>
          <header className="slab-label">
            <div className="slab-title">
              {card.name ? (
                <button type="button" className="slab-name" onClick={() => onOpenPokemon(card)}>
                  {card.name}
                </button>
              ) : (
                <span className="slab-name is-empty">未填卡名</span>
              )}
              <button type="button" className="slab-set" onClick={() => onOpenSet(card.setKey)}>
                {card.setCode}
                {card.lang === "zh" && SET_NAMES[card.setCode] ? `・${SET_NAMES[card.setCode]}` : `・${LANG_LABEL[card.lang]}`}
                <Icon name="forward" size={13} />
              </button>
            </div>
            <div className="slab-grade">
              <span className="slab-no">
                <strong>{card.number}</strong>
                {card.total ? <small>/ {card.total}</small> : null}
              </span>
              {card.rarity && <span className="slab-rarity">{card.rarity}</span>}
            </div>
          </header>
          <div className="slab-well">
            <TiltCard key={card.id} blob={card.photo} rarity={card.rarity} className="slab-card" alt={card.name} />
          </div>
        </article>
        <div className="group">
          <div className="group-row">
            <span>數量</span>
            <span className="stepper">
              <button type="button" aria-label="減少" onClick={() => setQty(card.qty - 1)} disabled={card.qty <= 1}>
                <Icon name="minus" size={16} />
              </button>
              <strong>{card.qty}</strong>
              <button type="button" aria-label="增加" onClick={() => setQty(card.qty + 1)}>
                <Icon name="plus" size={16} />
              </button>
            </span>
          </div>
        </div>
        <h2 className="section-title">標籤</h2>
        <div className="group">
          {card.tags.length > 0 && (
            <div className="pills group-pad">
              {card.tags.map((t) => (
                <button key={t} type="button" className="pill is-tag" onClick={() => removeTag(t)} aria-label={`移除標籤 ${t}`}>
                  {t}
                  <Icon name="close" size={12} />
                </button>
              ))}
            </div>
          )}
          <form className="tag-form" onSubmit={addTag}>
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="新增標籤，例如 交換用" />
            <button type="submit" className="head-action" disabled={!tag.trim()}>
              加入
            </button>
          </form>
        </div>
        <button type="button" className="danger-button" onClick={remove}>
          刪除這張卡片
        </button>
      </div>
    </div>
  );
}

export default CardDetail;
