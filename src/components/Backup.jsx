import { useEffect, useState } from "react";
import { exportBackup, importBackup } from "../db";

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
      <header className="page-head">
        <button type="button" className="text-button" onClick={onBack}>
          卡冊
        </button>
        <h1>備份</h1>
        <span />
      </header>
      <div className="backup">
        <p className="muted">卡片和照片只存在這支手機的瀏覽器裡。換手機或清除瀏覽器資料前，請先匯出備份檔。</p>
        <button type="button" className="button" onClick={download}>
          匯出備份檔
        </button>
        <label className="button is-ghost">
          匯入備份檔
          <input type="file" accept="application/json,.json" hidden onChange={upload} />
        </label>
        {message && <p>{message}</p>}
        {usage && <p className="muted small">已使用 {formatMb(usage.usage)}</p>}
        {persisted === false && navigator.storage?.persist && (
          <button type="button" className="text-button" onClick={persist}>
            要求瀏覽器保留資料，不要自動清除
          </button>
        )}
        {persisted && <p className="muted small">瀏覽器已同意保留資料</p>}
      </div>
    </div>
  );
}

export default Backup;
