import { useCallback, useEffect, useRef, useState } from "react";
import Binder from "./components/Binder";
import ListView from "./components/ListView";
import CardDetail from "./components/CardDetail";
import Scanner from "./components/Scanner";
import CardEditor from "./components/CardEditor";
import Backup from "./components/Backup";
import { saveCard } from "./db";

const HOME = { name: "binder", tab: "sets" };

function App() {
  const [view, setView] = useState(() => (window.history.state?.name ? window.history.state : HOME));
  const [toast, setToast] = useState("");
  const draft = useRef(null);

  useEffect(() => {
    if (!window.history.state?.name) window.history.replaceState(HOME, "");
    const onPop = (e) => setView(e.state?.name ? e.state : HOME);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (view.name === "edit" && !draft.current) window.history.back();
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback((next) => {
    window.history.pushState(next, "");
    setView(next);
  }, []);
  const back = useCallback(() => window.history.back(), []);

  const openList = (kind, value, backLabel) => go({ name: "list", kind, value, backLabel });
  const openCard = (card, backLabel) => go({ name: "card", id: card.id, backLabel });

  const onCaptured = ({ photo, result }) => {
    draft.current = { card: { photo }, result };
    go({ name: "edit" });
  };

  const editCard = (card) => {
    draft.current = { card, result: null };
    go({ name: "edit" });
  };

  const onSave = async (form, next) => {
    const editing = Boolean(draft.current.card.id);
    let merged;
    try {
      ({ merged } = await saveCard(form));
    } catch (err) {
      setToast(`儲存失敗：${err?.name || ""} ${err?.message || err}`);
      return;
    }
    draft.current = null;
    if (editing) {
      back();
      return;
    }
    setToast(merged ? "已經有這張卡，數量加 1" : "已加入卡冊");
    if (next === "scan") back();
    else window.history.go(-2);
  };

  if (view.name === "scan") return <Scanner onCaptured={onCaptured} onClose={back} />;

  return (
    <>
      {view.name === "binder" && (
        <Binder
          tab={view.tab}
          onTab={(tab) => {
            window.history.replaceState({ ...view, tab }, "");
            setView({ ...view, tab });
          }}
          onOpenSet={(key) => openList("set", key, "卡冊")}
          onOpenRarity={(r) => openList("rarity", r, "卡冊")}
          onOpenTag={(t) => openList("tag", t, "卡冊")}
          onScan={() => go({ name: "scan" })}
          onBackup={() => go({ name: "backup" })}
        />
      )}
      {view.name === "list" && (
        <ListView kind={view.kind} value={view.value} backLabel={view.backLabel} onBack={back} onOpen={(card) => openCard(card, "返回")} />
      )}
      {view.name === "card" && (
        <CardDetail
          id={view.id}
          backLabel={view.backLabel}
          onBack={back}
          onEdit={editCard}
          onOpenSet={(key) => openList("set", key, "返回")}
          onOpenPokemon={(card) => openList(card.dex ? "dex" : "name", { dex: card.dex, name: card.name }, "返回")}
        />
      )}
      {view.name === "edit" && draft.current && (
        <CardEditor card={draft.current.card} result={draft.current.result} onSave={onSave} onCancel={back} />
      )}
      {view.name === "backup" && <Backup onBack={back} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
