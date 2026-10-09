import { useEffect, useRef, useState } from "react";
import { CODE_REGION, NAME_REGION, readCard, warmUp } from "../ocr";

const CARD_W = 630;
const CARD_H = 880;
const OCR_MAX_W = 1000;

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
  const [busy, setBusy] = useState("");

  useEffect(() => {
    warmUp();
    let stream;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCameraError("無法開啟相機，可以改從相簿選照片"));
    if (!navigator.mediaDevices) setCameraError("這個瀏覽器不支援相機，可以改從相簿選照片");
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

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

  const capture = async () => {
    const frame = frameRef.current.getBoundingClientRect();
    let source;
    let rect;
    if (mode === "camera") {
      const video = videoRef.current;
      if (!video?.videoWidth) return;
      source = video;
      rect = mapFrame(frame, coverBox(video, video.videoWidth, video.videoHeight), video.videoWidth, video.videoHeight);
    } else {
      const img = imgRef.current;
      source = img;
      rect = mapFrame(frame, img.getBoundingClientRect(), img.naturalWidth, img.naturalHeight);
    }
    setBusy("辨識中");
    const ocrCanvas = cropToCanvas(source, rect, Math.min(OCR_MAX_W, Math.max(CARD_W, rect[2])));
    const photoBlob = await toBlob(cropToCanvas(ocrCanvas, [0, 0, ocrCanvas.width, ocrCanvas.height], CARD_W));
    let result = null;
    try {
      result = await readCard(ocrCanvas);
    } catch {
      result = null;
    }
    setBusy("");
    onCaptured({ photo: photoBlob, result });
  };

  const box = (r) => ({ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%` });

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
        <div ref={frameRef} className="scanner-frame">
          <span className="scanner-region" style={box(NAME_REGION)} />
          <span className="scanner-region is-code" style={box(CODE_REGION)} />
        </div>
      </div>
      <p className="scanner-hint">
        {cameraError && mode === "camera"
          ? cameraError
          : mode === "photo"
            ? "拖曳、縮放照片，讓卡片對準框線"
            : "卡片對準框線，卡號放進左下的小框"}
      </p>
      <div className="scanner-bar">
        <button type="button" className="text-button is-light" onClick={onClose}>
          取消
        </button>
        <button type="button" className="shutter" aria-label="拍照" onClick={capture} disabled={Boolean(busy)} />
        <label className="text-button is-light">
          相簿
          <input type="file" accept="image/*" hidden onChange={pickPhoto} />
        </label>
      </div>
      {busy && (
        <div className="scanner-busy">
          <p>{busy}</p>
          <p className="muted">第一次使用要下載辨識資料，需要一點時間</p>
        </div>
      )}
    </div>
  );
}

export default Scanner;
