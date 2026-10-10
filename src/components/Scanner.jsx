import { useEffect, useRef, useState } from "react";
import { isReady, locate, readCard, straighten, warmUp } from "../ocr";
import { db } from "../db";

const CARD_W = 630;
const CARD_H = 880;
const OCR_MAX_W = 1000;
const LIVE_MS = 400;

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

const cameraMessage = (err) => CAMERA_ERRORS[err?.name] || `無法開啟相機（${err?.name || "未知原因"}）`;

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

function Scanner({ onCaptured, onClose }) {
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

  const streamRef = useRef(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    warmUp();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(window.isSecureContext ? "這個瀏覽器不支援相機，請改用 Safari 或 Chrome 開啟" : "網址不是 https，瀏覽器不允許使用相機");
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

  const pickPhoto = (e) => {
    const file = e.target.files[0];
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
    if (mode !== "photo") return;
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
    if (mode !== "photo") return;
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
    if (busy || (mode === "camera" && cameraError)) return;
    let hits = 0;
    const timer = setInterval(() => {
      const target = sourceRect();
      if (!target) return;
      const quad = locate(target.source, target.rect);
      hits = quad ? hits + 1 : 0;
      setFound(hits >= 2 ? quad : null);
    }, LIVE_MS);
    return () => clearInterval(timer);
  }, [mode, busy, cameraError]);

  const capture = async () => {
    const target = sourceRect();
    if (!target) return;
    const { source, rect } = target;
    if (mode === "camera") videoRef.current.pause();
    setBusy(true);
    const framed = cropToCanvas(source, rect, Math.min(OCR_MAX_W, Math.max(CARD_W, rect[2])));
    const card = straighten(framed) || framed;
    const photoBlob = await toBlob(cropToCanvas(card, [0, 0, card.width, card.height], CARD_W));
    let result = null;
    try {
      const knownSets = [...new Set((await db.cards.toArray()).map((c) => c.setCode))];
      result = await readCard(card, framed, knownSets);
    } catch {
      result = null;
    }
    setBusy(false);
    onCaptured({ photo: photoBlob, result });
  };

  const hint =
    cameraError && mode === "camera"
      ? `${cameraError}，也可以改從相簿選照片`
      : busy
        ? "辨識中，可以放下手機"
        : found
          ? "找到卡片，可以拍了"
          : mode === "photo"
            ? "拖曳、縮放照片，讓卡片在框內"
            : "把卡片放進框內，不用對齊";

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
        <div ref={frameRef} className={found ? "scanner-frame is-found" : "scanner-frame"}>
          <span className="corner is-tl" />
          <span className="corner is-tr" />
          <span className="corner is-br" />
          <span className="corner is-bl" />
          {found && !busy && (
            <svg className="scanner-outline" viewBox="0 0 1 1" preserveAspectRatio="none">
              <polygon points={found.map(([x, y]) => `${x},${y}`).join(" ")} />
            </svg>
          )}
          {busy && <span className="scanner-sweep" />}
        </div>
        <div className={found || busy ? "scanner-hint is-on" : "scanner-hint"}>
          {cameraError && mode === "camera" && (
            <button type="button" className="retry" onClick={() => setAttempt((n) => n + 1)}>
              重試
            </button>
          )}
          <p>{hint}</p>
          {busy && !isReady() && <p className="scanner-note">第一次使用要下載約 13MB 的辨識資料，需要一點時間</p>}
        </div>
      </div>
      <div className="scanner-bar">
        <button type="button" className="text-button is-light" onClick={onClose}>
          取消
        </button>
        <button type="button" className={found ? "shutter is-ready" : "shutter"} aria-label="拍照" onClick={capture} disabled={busy} />
        <label className="text-button is-light">
          相簿
          <input type="file" accept="image/*" hidden onChange={pickPhoto} />
        </label>
      </div>
    </div>
  );
}

export default Scanner;
