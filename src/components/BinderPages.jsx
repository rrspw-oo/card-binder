import { useEffect, useRef, useState } from "react";
import Photo from "./Photo";

const PER_PAGE = 9;

function BinderPages({ slots, start, onOpen }) {
  const ref = useRef(null);
  const [page, setPage] = useState(0);
  const opened = useRef(false);
  const pages = [];
  for (let i = 0; i < slots.length; i += PER_PAGE) pages.push(slots.slice(i, i + PER_PAGE));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (opened.current || !el || start < 0) return;
    opened.current = true;
    const target = Math.floor(start / PER_PAGE);
    el.scrollLeft = target * el.clientWidth;
    setPage(target);
  }, [start]);

  const turn = (delta) => {
    const el = ref.current;
    el.scrollTo({ left: (page + delta) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="binder">
      <div ref={ref} className="binder-pages">
        {pages.map((items, p) => (
          <section key={p} className="sheet" aria-label={`第 ${p + 1} 頁`}>
            {items.map((slot) => (
              <div key={slot.key} className={`pocket ${slot.card ? "" : "is-empty"}`}>
                {slot.card ? (
                  <button type="button" className="pocket-card" onClick={() => onOpen(slot.card)}>
                    <Photo blob={slot.card.photo} className="card-img" alt={slot.card.name || slot.label} />
                    {slot.card.qty > 1 && <span className="pocket-qty">{slot.card.qty}</span>}
                  </button>
                ) : (
                  <span className="pocket-no">{slot.label}</span>
                )}
              </div>
            ))}
            {Array.from({ length: PER_PAGE - items.length }, (_, i) => (
              <div key={`pad-${i}`} className="pocket is-blank" />
            ))}
          </section>
        ))}
      </div>
      {pages.length > 1 && pages.length <= 20 && (
        <div className="dots" role="tablist">
          {pages.map((_, p) => (
            <button key={p} type="button" role="tab" aria-label={`第 ${p + 1} 頁`} aria-selected={p === page} className={p === page ? "is-on" : ""} onClick={() => turn(p - page)} />
          ))}
        </div>
      )}
      {pages.length > 1 && (
        <p className="page-no">
          {page + 1} / {pages.length}
        </p>
      )}
    </div>
  );
}

export default BinderPages;
