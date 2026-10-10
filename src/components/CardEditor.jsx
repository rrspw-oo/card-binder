import { useMemo, useState } from "react";
import Photo from "./Photo";
import { LANGS, RARITIES, searchNames } from "../parse";

const LAST_SET = "lastSet";

const readLast = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_SET)) || {};
  } catch {
    return {};
  }
};

function initialForm(card, result) {
  if (card.id) return { ...card };
  const last = readLast();
  const match = result?.match;
  return {
    photo: card.photo,
    lang: result?.lang || last.lang || match?.lang || "zh",
    setCode: last.setCode || "",
    total: result?.total || last.total || "",
    number: result?.number || "",
    rarity: result?.rarity || "",
    name: match?.name || "",
    dex: match?.dex || null,
    qty: 1,
  };
}

function CardEditor({ card, result, onSave, onCancel }) {
  const [form, setForm] = useState(() => initialForm(card, result));
  const [nameFocus, setNameFocus] = useState(false);
  const suggestions = useMemo(() => (nameFocus ? searchNames(form.name, form.lang) : []), [form.name, form.lang, nameFocus]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.setCode.trim() && form.number.trim();

  const submit = (next) => {
    const out = {
      ...form,
      setCode: form.setCode.trim(),
      number: form.number.trim().padStart(3, "0"),
      total: form.total.trim(),
      name: form.name.trim(),
      qty: Number(form.qty) || 1,
    };
    try {
      localStorage.setItem(LAST_SET, JSON.stringify({ lang: out.lang, setCode: out.setCode, total: out.total }));
    } catch {
      return onSave(out, next);
    }
    onSave(out, next);
  };

  return (
    <div className="page">
      <header className="page-head">
        <button type="button" className="text-button" onClick={onCancel}>
          取消
        </button>
        <h1>{card.id ? "編輯卡片" : "確認卡片"}</h1>
        <span />
      </header>
      <div className="editor">
        <Photo blob={form.photo} className="editor-photo" />
        {result && (
          <p className="muted small">
            {result.number ? `讀到卡號 ${result.number}/${result.total}${result.rarity ? ` ${result.rarity}` : ""}` : "沒有讀到卡號，請手動輸入"}
            {result.match ? `，卡名 ${result.match.name}` : ""}
          </p>
        )}
        <div className="field-row">
          <label className="field">
            <span>系列代號</span>
            <input value={form.setCode} onChange={set("setCode")} placeholder="M6a" autoCapitalize="off" />
          </label>
          <label className="field is-small">
            <span>語言</span>
            <select value={form.lang} onChange={set("lang")}>
              {LANGS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>卡號</span>
            <input value={form.number} onChange={set("number")} inputMode="numeric" placeholder="065" />
          </label>
          <label className="field">
            <span>總張數</span>
            <input value={form.total} onChange={set("total")} inputMode="numeric" placeholder="103" />
          </label>
          <label className="field is-small">
            <span>稀有度</span>
            <select value={form.rarity} onChange={set("rarity")}>
              <option value="">無</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>卡名</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, dex: null }))}
            onFocus={() => setNameFocus(true)}
            onBlur={() => setTimeout(() => setNameFocus(false), 150)}
            placeholder="寶可夢名稱或卡名"
          />
        </label>
        {suggestions.length > 0 && (
          <ul className="suggest">
            {suggestions.map((s) => (
              <li key={s.dex}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setForm((f) => ({ ...f, name: s.name, dex: s.dex }))}>
                  {s.name}
                  <span className="muted">#{String(s.dex).padStart(4, "0")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="field is-small">
          <span>數量</span>
          <input value={form.qty} onChange={set("qty")} inputMode="numeric" />
        </label>
      </div>
      <footer className="page-foot">
        {!card.id && (
          <button type="button" className="button" disabled={!valid} onClick={() => submit("scan")}>
            儲存，繼續掃描
          </button>
        )}
        <button type="button" className={card.id ? "button" : "button is-ghost"} disabled={!valid} onClick={() => submit("done")}>
          儲存
        </button>
      </footer>
    </div>
  );
}

export default CardEditor;
