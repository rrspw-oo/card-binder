import { useRef, useState } from "react";
import Photo from "./Photo";
import { isPremium } from "../parse";

const MAX_TILT = 16;
const SPARKS = [
  [22, 18, 0],
  [74, 30, 120],
  [40, 55, 240],
  [80, 70, 360],
  [28, 82, 480],
  [58, 12, 560],
];

function TiltCard({ blob, rarity = "", className = "", alt = "", onSwipe, hint = true }) {
  const premium = isPremium(rarity);
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  const gesture = useRef(null);

  const tilt = (e) => {
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  };

  const start = (e) => {
    gesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), mode: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.mode) {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      const dt = performance.now() - g.t;
      if (Math.hypot(dx, dy) > 10) g.mode = dt < 200 && Math.abs(dx) > Math.abs(dy) * 1.5 ? "swipe" : "tilt";
      else if (dt > 200) g.mode = "tilt";
      if (g.mode === "tilt") setActive(true);
    }
    if (g.mode === "tilt") tilt(e);
  };

  const end = (e) => {
    const g = gesture.current;
    gesture.current = null;
    if (g && g.mode !== "tilt" && onSwipe && e.type === "pointerup") {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - g.t < 700) onSwipe(dx < 0 ? 1 : -1);
    }
    const el = ref.current;
    setActive(false);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={ref}
      className={`tilt${active ? " is-active" : ""}${hint ? "" : " no-hint"} ${className}`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="tilt-inner">
        <Photo blob={blob} className="card-img" alt={alt} />
        {premium ? (
          <>
            <span className="shine-holo" aria-hidden="true" />
            <span className="shine-ring" aria-hidden="true" />
          </>
        ) : (
          <span className="shine-sparks" aria-hidden="true">
            {SPARKS.map(([x, y, delay]) => (
              <span key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay + 60}ms` }} />
            ))}
          </span>
        )}
        <span className="tilt-glare" aria-hidden="true" />
      </div>
    </div>
  );
}

export default TiltCard;
