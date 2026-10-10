import { useEffect, useState } from "react";
import { exportBackup, importBackup } from "../db";
import PageHead from "./PageHead";

const formatMb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function Backup({ onBack }) {
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState(null);
  const [persisted, setPersisted] = useState(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then(setUsage);
    navigator.storage?.persisted?.().then(setPersisted);
  }, [message]);

  const download = async () => {
    const blob = await exportBackup();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `card-binder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("備份檔已產生");
  };

  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !window.confirm("匯入會取代目前手機上的全部卡片，確定嗎？")) return;
    try {
      const n = await importBackup(file);
      setMessage(`已匯入 ${n} 張卡片`);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const persist = async () => setPersisted(await navigator.storage.persist());

  return (
    <div className="page">
      <PageHead back="收藏" onBack={onBack} title="備份" />
      <div className="backup">
        <p className="lead">卡片和照片只存在這支手機裡。換手機或清除瀏覽器資料前，先匯出備份檔。</p>
        <div className="group">
          <button type="button" className="group-row" onClick={download}>
            <span>匯出備份檔</span>
          </button>
          <label className="group-row">
            <span>匯入備份檔</span>
            <span className="group-value">會取代目前的卡片</span>
            <input type="file" accept="application/json,.json" hidden onChange={upload} />
          </label>
        </div>
        {message && <p className="notice">{message}</p>}
        <p className="muted small">
          {usage ? `已使用 ${formatMb(usage.usage)}` : ""}
          {persisted ? "，瀏覽器已同意保留資料" : ""}
        </p>
        {persisted === false && navigator.storage?.persist && (
          <button type="button" className="head-action" onClick={persist}>
            要求瀏覽器保留資料，不要自動清除
          </button>
        )}
      </div>
    </div>
  );
}

export default Backup;
