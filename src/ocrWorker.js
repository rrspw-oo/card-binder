import { PaddleOcrService } from "ppu-paddle-ocr/web";

const base = new URL(`${import.meta.env.BASE_URL}models/`, self.location.origin).href;

const service = new PaddleOcrService({
  model: {
    detection: `${base}PP-OCRv6_tiny_det.ort`,
    recognition: `${base}PP-OCRv6_tiny_rec.ort`,
    charactersDictionary: `${base}ppocrv6_tiny_dict.txt`,
  },
});
const ready = service.initialize();

self.onmessage = async ({ data }) => {
  try {
    await ready;
    if (!data.image) {
      self.postMessage({ id: data.id, text: "" });
      return;
    }
    const result = await service.recognize(data.image);
    self.postMessage({ id: data.id, text: result.text || "" });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
