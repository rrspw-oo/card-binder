import { useMemo, useRef, useState } from "react";
import Photo from "./Photo";
import { LANGS, RARITIES, RECENT_SETS, SET_NAMES, searchNames } from "../parse";

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
    setCode: result?.setCode || last.setCode || "",
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
  const setCodeRef = useRef(null);
  const numberRef = useRef(null);
  const [tried, setTried] = useState(false);
  const missing = [!form.setCode.trim() && ["系列代號", setCodeRef], !form.number.trim() && ["卡號", numberRef]].filter(Boolean);

  const submit = (next) => {
    if (missing.length) {
      setTried(true);
      missing[0][1].current.focus();
      return;
    }
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
            {result.setCode ? `，系列 ${result.setCode}` : ""}
          </p>
        )}
        <div className="field-row">
          <label className={tried && !form.setCode.trim() ? "field is-missing" : "field"}>
            <span>系列代號</span>
            <input ref={setCodeRef} value={form.setCode} onChange={set("setCode")} placeholder="例：M6a" autoCapitalize="off" />
            {SET_NAMES[form.setCode.trim()] && <small className="field-note">{SET_NAMES[form.setCode.trim()]}</small>}
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
        {(result?.setCandidates?.length > 0 || !form.setCode.trim()) && (
          <div className="chips set-chips">
            <span className="muted small">{result?.setCandidates?.length > 0 ? "也可能是" : "最新系列"}</span>
            {(result?.setCandidates?.length > 0 ? [result.setCode, ...result.setCandidates] : RECENT_SETS).map((code) => (
              <button
                key={code}
                type="button"
                className={form.setCode === code ? "chip is-on" : "chip"}
                onClick={() => setForm((f) => ({ ...f, setCode: code }))}
              >
                {code} {SET_NAMES[code] || ""}
              </button>
            ))}
          </div>
        )}
        {!form.setCode.trim() && <p className="muted small">系列代號在卡片左下角的小框裡，同一包卡只要填一次，之後會自動帶入</p>}
        <div className="field-row">
          <label className={tried && !form.number.trim() ? "field is-missing" : "field"}>
            <span>卡號</span>
            <input ref={numberRef} value={form.number} onChange={set("number")} inputMode="numeric" placeholder="065" />
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
      <footer className={card.id ? "page-foot is-floating is-row is-single" : "page-foot is-floating is-row"}>
        {tried && missing.length > 0 && <p className="foot-error">請填寫{missing.map(([label]) => label).join("、")}</p>}
        <button type="button" className={card.id ? "button" : "button is-ghost"} onClick={() => submit("done")}>
          儲存
        </button>
        {!card.id && (
          <button type="button" className="button" onClick={() => submit("scan")}>
            儲存，繼續掃描
          </button>
        )}
      </footer>
    </div>
  );
}

export default CardEditor;
