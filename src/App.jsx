import { useCallback, useEffect, useRef, useState } from "react";
import Binder from "./components/Binder";
import ListView from "./components/ListView";
import CardDetail from "./components/CardDetail";
import Scanner from "./components/Scanner";
import CardEditor from "./components/CardEditor";
import Backup from "./components/Backup";
import PokemonList from "./components/PokemonList";
import { db, saveCard } from "./db";

const HOME = { name: "binder" };

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
  const openCard = (card, backLabel, list = []) => go({ name: "card", id: card.id, backLabel, ids: list.map((c) => c.id) });
  const moveCard = (id) => {
    const next = { ...window.history.state, id };
    window.history.replaceState(next, "");
    setView(next);
  };

  const editCard = (card) => {
    draft.current = { card, result: null };
    go({ name: "edit" });
  };

  const onSave = async (form) => {
    try {
      await saveCard(form);
    } catch (err) {
      setToast(`儲存失敗：${err?.name || ""} ${err?.message || err}`);
      return;
    }
    draft.current = null;
    back();
  };

  const onDelete = async () => {
    await db.cards.delete(draft.current.card.id);
    draft.current = null;
    back();
  };

  if (view.name === "scan") return <Scanner onClose={back} />;

  return (
    <>
      {view.name === "binder" && (
        <Binder
          onOpenSet={(key) => openList("set", key, "收藏")}
          onOpenRarity={(r) => openList("rarity", r, "收藏")}
          onOpenTag={(t) => openList("tag", t, "收藏")}
          onOpenCard={(card, list) => openCard(card, "收藏", list)}
          onOpenPokemon={() => go({ name: "pokemon" })}
          onScan={() => go({ name: "scan" })}
          onBackup={() => go({ name: "backup" })}
        />
      )}
      {view.name === "list" && (
        <ListView kind={view.kind} value={view.value} backLabel={view.backLabel} onBack={back} onOpen={(card, label, list) => openCard(card, label, list)} />
      )}
      {view.name === "card" && (
        <CardDetail
          id={view.id}
          ids={view.ids || []}
          onMove={moveCard}
          backLabel={view.backLabel}
          onBack={back}
          onEdit={editCard}
          onOpenSet={(key) => openList("set", key, "返回")}
          onOpenPokemon={(card) => openList(card.dex ? "dex" : "name", { dex: card.dex, name: card.name }, "返回")}
        />
      )}
      {view.name === "edit" && draft.current && (
        <CardEditor card={draft.current.card} result={draft.current.result} onSave={onSave} onCancel={back} onDelete={onDelete} />
      )}
      {view.name === "pokemon" && <PokemonList onBack={back} onOpen={(card) => openList(card.dex ? "dex" : "name", { dex: card.dex, name: card.name }, "寶可夢")} />}
      {view.name === "backup" && <Backup onBack={back} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
