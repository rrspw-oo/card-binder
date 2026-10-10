import { PaddleOcrService } from "ppu-paddle-ocr/web";

const base = new URL(`${import.meta.env.BASE_URL}models/`, self.location.origin).href;

const service = new PaddleOcrService({
  model: {
    detection: `${base}PP-OCRv6_tiny_det.ort`,
    recognition: `${base}PP-OCRv6_tiny_rec.ort`,
    charactersDictionary: `${base}ppocrv6_tiny_dict.txt`,
  },
});
const startedAt = performance.now();
let loadSeconds = 0;
const ready = service.initialize().then(() => {
  loadSeconds = (performance.now() - startedAt) / 1000;
});

self.onmessage = async ({ data }) => {
  try {
    await ready;
    if (!data.image) {
      self.postMessage({ id: data.id, text: "", loadSeconds });
      return;
    }
    const result = await service.recognize(data.image);
    self.postMessage({ id: data.id, text: result.text || "", loadSeconds });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
