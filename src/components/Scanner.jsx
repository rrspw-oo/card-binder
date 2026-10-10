import { useEffect, useRef, useState } from "react";
import { isReady, locate, readCard, straighten, warmUp } from "../ocr";
import { db, saveCard } from "../db";
import CardEditor from "./CardEditor";
import Icon from "./Icon";

const CARD_W = 630;
const CARD_H = 880;
const OCR_MAX_W = 1000;
const LIVE_MS = 450;
const STEADY = 3;
const STEADY_MOVE = 0.03;

function mapFrame(frame, box, naturalW, naturalH) {
  const sx = naturalW / box.width;
  const sy = naturalH / box.height;
  return [(frame.left - box.left) * sx, (frame.top - box.top) * sy, frame.width * sx, frame.height * sy];
}

function coverBox(el, naturalW, naturalH) {
  const r = el.getBoundingClientRect();
  const scale = Math.max(r.width / naturalW, r.height / naturalH);
  const w = naturalW * scale;
  const h = naturalH * scale;
  return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
}

function cropToCanvas(source, [x, y, w, h], width) {
  const c = document.createElement("canvas");
  c.width = Math.round(width);
  c.height = Math.round((width * h) / w);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}

const CAMERA = { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } };

const CAMERA_ERRORS = {
  NotAllowedError: "相機權限被拒絕。請在瀏覽器的網站設定允許相機，再按重試",
  SecurityError: "相機權限被拒絕。請在瀏覽器的網站設定允許相機，再按重試",
  NotFoundError: "這支手機找不到可用的相機",
  NotReadableError: "相機正被其他 App 使用，關掉後再按重試",
  AbortError: "相機正被其他 App 使用，關掉後再按重試",
};

const CHROME_IOS = /CriOS/.test(navigator.userAgent);
const CHROME_IOS_DENIED = "Chrome 沒有拿到相機權限。到 iPhone 的「設定」→「App」→「Chrome」打開「相機」；再到 Chrome 選單的「設定」→「網站設定」→「相機」確認這個網站沒有被封鎖，然後按重試";

const cameraMessage = (err) => {
  if (CHROME_IOS && (err?.name === "NotAllowedError" || err?.name === "SecurityError")) return CHROME_IOS_DENIED;
  return CAMERA_ERRORS[err?.name] || `無法開啟相機（${err?.name || "未知原因"}）`;
};

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

function Scanner({ onClose, onPhoto }) {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const frameRef = useRef(null);
  const pointers = useRef(new Map());
  const [mode, setMode] = useState("camera");
  const [cameraError, setCameraError] = useState("");
  const [photo, setPhoto] = useState(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [steady, setSteady] = useState(false);
  const [pending, setPending] = useState(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(0);
  const armed = useRef(true);
  const captureRef = useRef(null);

  const streamRef = useRef(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    warmUp();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(!window.isSecureContext ? "網址不是 https，瀏覽器不允許使用相機" : CHROME_IOS ? "這個版本的 iPhone 不讓 Chrome 使用相機（需要 iOS 14.3 以上），請改用 Safari 開啟" : "這個瀏覽器不支援相機，請改用 Safari 或 Chrome 開啟");
      return;
    }
    const attach = (s) => {
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = s;
      setCameraError("");
      if (videoRef.current) videoRef.current.srcObject = s;
    };
    navigator.mediaDevices
      .getUserMedia({ video: CAMERA, audio: false })
      .catch((err) => {
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") throw err;
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      })
      .then(attach)
      .catch((err) => !cancelled && setCameraError(cameraMessage(err)));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 2200);
    return () => clearTimeout(t);
  }, [note]);

  const pickPhoto = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPhoto({ url: URL.createObjectURL(file) });
    setView({ scale: 1, x: 0, y: 0 });
    setMode("photo");
  };

  const fitPhoto = () => {
    const img = imgRef.current;
    const stage = img.parentElement.getBoundingClientRect();
    const fit = Math.min(stage.width / img.naturalWidth, stage.height / img.naturalHeight);
    img.style.width = `${img.naturalWidth * fit}px`;
    img.style.height = `${img.naturalHeight * fit}px`;
  };

  const onPointerDown = (e) => {
    if (mode !== "photo" || pending) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e) => {
    const map = pointers.current;
    if (!map.has(e.pointerId)) return;
    const prev = [...map.values()];
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const next = [...map.values()];
    if (next.length === 1) {
      setView((v) => ({ ...v, x: v.x + next[0].x - prev[0].x, y: v.y + next[0].y - prev[0].y }));
    } else if (next.length === 2) {
      const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const ratio = dist(next) / dist(prev);
      setView((v) => ({ ...v, scale: Math.min(8, Math.max(0.3, v.scale * ratio)) }));
    }
  };

  const onPointerUp = (e) => pointers.current.delete(e.pointerId);

  const onWheel = (e) => {
    if (mode !== "photo" || pending) return;
    setView((v) => ({ ...v, scale: Math.min(8, Math.max(0.3, v.scale * (e.deltaY < 0 ? 1.08 : 0.92))) }));
  };

  const sourceRect = () => {
    const frame = frameRef.current.getBoundingClientRect();
    if (mode === "camera") {
      const video = videoRef.current;
      if (!video?.videoWidth) return null;
      return { source: video, rect: mapFrame(frame, coverBox(video, video.videoWidth, video.videoHeight), video.videoWidth, video.videoHeight) };
    }
    const img = imgRef.current;
    if (!img?.naturalWidth) return null;
    return { source: img, rect: mapFrame(frame, img.getBoundingClientRect(), img.naturalWidth, img.naturalHeight) };
  };

  useEffect(() => {
    setFound(null);
    setSteady(false);
    if (busy || pending || (mode === "camera" && cameraError)) return;
    let last = null;
    let still = 0;
    const timer = setInterval(() => {
      const target = sourceRect();
      if (!target) return;
      const quad = locate(target.source, target.rect);
      if (!quad) {
        last = null;
        still = 0;
        armed.current = true;
        setFound(null);
        setSteady(false);
        return;
      }
      const moved = last ? Math.max(...quad.map(([x, y], i) => Math.hypot(x - last[i][0], y - last[i][1]))) : 1;
      still = moved < STEADY_MOVE ? still + 1 : 1;
      last = quad;
      setFound(quad);
      setSteady(mode === "camera" && armed.current && still >= 2);
      if (mode === "camera" && armed.current && still >= STEADY) captureRef.current();
    }, LIVE_MS);
    return () => clearInterval(timer);
  }, [mode, busy, pending, cameraError]);

  const capture = async () => {
    const target = sourceRect();
    if (!target || busy) return;
    const { source, rect } = target;
    if (mode === "camera") videoRef.current.pause();
    setBusy(true);
    const framed = cropToCanvas(source, rect, Math.min(OCR_MAX_W, Math.max(CARD_W, rect[2])));
    const card = straighten(framed) || framed;
    const photoBlob = await toBlob(cropToCanvas(card, [0, 0, card.width, card.height], CARD_W));
    if (onPhoto) {
      setBusy(false);
      onPhoto(photoBlob);
      return;
    }
    let result = null;
    try {
      const knownSets = [...new Set((await db.cards.toArray()).map((c) => c.setCode))];
      result = await readCard(card, framed, knownSets);
    } catch {
      result = null;
    }
    setBusy(false);
    setPending({ photo: photoBlob, result, key: Date.now() });
  };
  captureRef.current = capture;

  const resume = () => {
    setPending(null);
    if (mode === "camera") videoRef.current?.play();
  };

  const retake = () => {
    armed.current = true;
    resume();
  };

  const save = async (form) => {
    try {
      const { merged } = await saveCard(form);
      setNote(merged ? `已經有 ${form.setCode} ${form.number}，數量加 1` : `已收進 ${form.setCode} ${form.number}`);
      setSaved((n) => n + 1);
    } catch (err) {
      setNote(`儲存失敗：${err?.name || ""} ${err?.message || err}`);
      return;
    }
    armed.current = false;
    resume();
  };

  const hint =
    cameraError && mode === "camera"
      ? `${cameraError}，也可以改從相簿選照片`
      : busy
        ? "辨識中，可以放下手機"
        : steady
          ? "保持不動，馬上拍"
          : found
            ? mode === "camera"
              ? "找到卡片"
              : "找到卡片，按下快門"
            : mode === "photo"
              ? "拖曳、縮放照片，讓卡片在框內"
              : onPhoto
                ? "重拍這張卡，放進框內會自動拍照"
                : armed.current
                ? "把卡片放進框內，會自動拍照"
                : "換下一張卡片";

  return (
    <div className="scanner">
      <div
        className="scanner-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {mode === "camera" ? (
          <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
        ) : (
          <img
            ref={imgRef}
            className="scanner-photo"
            src={photo?.url}
            alt=""
            draggable="false"
            onLoad={fitPhoto}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          />
        )}
        <div ref={frameRef} className={`scanner-frame${found ? " is-found" : ""}${steady ? " is-steady" : ""}`}>
          <span className="corner is-tl" />
          <span className="corner is-tr" />
          <span className="corner is-br" />
          <span className="corner is-bl" />
          {found && !busy && !pending && (
            <svg className="scanner-outline" viewBox="0 0 1 1" preserveAspectRatio="none">
              <polygon points={found.map(([x, y]) => `${x},${y}`).join(" ")} />
            </svg>
          )}
          {busy && <span className="scanner-sweep" />}
        </div>
        <div className="scanner-top">
          <button type="button" className="scanner-done" onClick={onClose}>
            {onPhoto ? "取消" : saved ? `完成（${saved}）` : "完成"}
          </button>
        </div>
        {!pending && (
          <div className={found || busy ? "scanner-hint is-on" : "scanner-hint"}>
            {cameraError && mode === "camera" && (
              <button type="button" className="retry" onClick={() => setAttempt((n) => n + 1)}>
                重試
              </button>
            )}
            <p>{hint}</p>
            {busy && !isReady() && <p className="scanner-note">第一次使用要下載約 13MB 的辨識資料，需要一點時間</p>}
          </div>
        )}
        {note && <div className="scanner-toast">{note}</div>}
      </div>
      <div className="scanner-bar">
        <span />
        <button type="button" className={found ? "shutter is-ready" : "shutter"} aria-label="拍照" onClick={capture} disabled={busy || Boolean(pending)} />
        <label className="scanner-album">
          <Icon name="photos" />
          <span>相簿</span>
          <input type="file" accept="image/*" hidden onChange={pickPhoto} />
        </label>
      </div>
      {pending && (
        <div className="sheet-backdrop">
          <CardEditor key={pending.key} sheet card={{ photo: pending.photo }} result={pending.result} onSave={save} onCancel={retake} />
        </div>
      )}
    </div>
  );
}

export default Scanner;
