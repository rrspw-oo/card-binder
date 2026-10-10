# Card Binder

[English](README.md) | [Architecture](docs/ARCHITECTURE.md)

用手機整理實體寶可夢卡牌收藏的 PWA。把卡片對準畫面上的框線拍照，確認讀到的系列、卡號和卡名，就會放進卡冊：每個卡號都有固定的卡套位置，一眼看出有哪些卡、還缺哪幾號、哪些重複。

- 自動找出卡片並拉正，再用 PaddleOCR 在手機上辨識卡號、稀有度、全國圖鑑編號和卡名；照片不會上傳，也不用對準
- 依系列分冊，也可以依稀有度、自訂標籤或同一隻寶可夢查看
- 支援繁中、日文、英文卡
- 資料只存在自己的瀏覽器裡；換手機時用備份檔匯出、匯入

## 開發

```bash
npm install
npm run dev
npm run build
```

## 資料來源

- 寶可夢名稱：[PokeAPI](https://pokeapi.co/)
- 繁中系列代號與名稱：寶可夢卡牌官方卡牌搜尋頁（asia.pokemon-card.com/tw），只取代號與名稱
- 文字辨識：[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv6 模型（Apache-2.0，見 `public/models/`），透過 [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) 與 [ONNX Runtime Web](https://onnxruntime.ai/) 執行

Pokémon 及卡牌名稱、圖像之版權屬於 Nintendo、Creatures、GAME FREAK 與 The Pokémon Company。本專案為非官方粉絲作品。

## 授權

MIT
