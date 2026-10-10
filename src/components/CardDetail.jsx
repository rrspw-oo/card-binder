import { useEffect, useRef, useState } from "react";
import { db } from "../db";
import { useLive } from "../useLive";
import { LANGS, SET_NAMES, isPremium } from "../parse";
import TiltCard from "./TiltCard";
import PageHead from "./PageHead";
import Icon from "./Icon";

const LANG_LABEL = Object.fromEntries(LANGS);

function CardDetail({ id, ids, onMove, onBack, backLabel, onEdit, onOpenPokemon, onOpenSet }) {
  const card = useLive(() => db.cards.get(id).then((c) => c || null), [id]);

  const left = useRef(false);
  const [dir, setDir] = useState(0);
  const index = ids.indexOf(id);
  const go = (step) => {
    const next = ids[index + step];
    if (index < 0 || !next) return;
    setDir(step);
    onMove(next);
  };

  useEffect(() => {
    if (card !== null || left.current) return;
    left.current = true;
    onBack();
  }, [card, onBack]);

  if (!card) return null;

  return (
    <div className="page is-fit">
      <PageHead
        back={backLabel}
        onBack={onBack}
        title={index >= 0 && ids.length > 1 ? <span className="head-count">{index + 1} / {ids.length}</span> : ""}
        right={
          <button type="button" className="head-action" onClick={() => onEdit(card)}>
            編輯
          </button>
        }
      />
      <div className="detail">
        <article key={card.id} className={`slab${isPremium(card.rarity) ? " is-premium" : ""}${dir ? " is-switched" : ""}`}>
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
              {(card.rarity || card.qty > 1) && (
                <span className="slab-tags">
                  {card.qty > 1 && <span className="slab-qty">×{card.qty}</span>}
                  {card.rarity && <span className="slab-rarity">{card.rarity}</span>}
                </span>
              )}
            </div>
          </header>
          <div className="slab-well">
            <TiltCard key={card.id} blob={card.photo} rarity={card.rarity} className="slab-card" alt={card.name} onSwipe={go} hint={dir === 0} />
          </div>
        </article>
      </div>
    </div>
  );
}

export default CardDetail;
