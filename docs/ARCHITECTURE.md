# Architecture

[README](../README.md) | [繁體中文 README](../README.zh-TW.md)

Mobile-first PWA for keeping track of physical Pokémon TCG cards. Photograph a card, confirm what was read, and it lands in a binder. Deployed to GitHub Pages under `/card-binder/` from `main`.

## Design

- Neutral grays only (`--bg`, `--surface`, `--ink`, `--soft`, `--line`, `--tint` in `src/index.css`); the card photos are the only color. System font, no emoji.
- Home (`Binder.jsx`): tabs 系列 / 稀有度 / 自訂. 系列 is a shelf of binder covers, 2 columns (3 from 600px): each cover shows the set's highest-rarity card (by `RARITIES` order, lowest number on ties) on a white cover with a left spine, the set code, language, `owned / total`, duplicates and a thin progress bar. 稀有度 and 自訂 are plain rows with counts. A full-width 掃描 button floats at the bottom.
- Binder pages (`BinderPages.jsx`): 3x3 pockets per white sheet, swiped horizontally with scroll snap, plus 上一頁 / 下一頁 and `page / pages`. In a set with a known total, every number from 1 to the total has a fixed pocket in order (card 040 sits in the 4th pocket of page 5); empty pockets show the number in light gray; cards numbered above the total (secret rares) follow after the last numbered pocket. With a rarity filter, or in rarity, tag and Pokemon lists, cards fill the pockets in order without gaps. Filled pockets get a faint diagonal sheen like a plastic sleeve and a quantity badge when more than one copy is owned. Below a set, 還缺 N 張 lists the missing numbers as ranges.
- Card page (`CardDetail.jsx`): large photo, name (tap to list every card of that Pokemon), set (tap to open its binder), number, rarity, quantity stepper, tags, edit, delete.
- Installed PWA: `overscroll-behavior-y: none` on `html` and `body` under `display-mode: standalone`; layout heights use `100dvh` and safe-area insets.

## Scanning

- `Scanner.jsx`: rear camera (`getUserMedia`, ideal 1920x1080) under a card-shaped frame (63:88, `min(92vw, (100dvh - 150px) * 63 / 88)`, 359x501 on a 390x844 screen) with the rest dimmed and no inner boxes; the hint 「卡片放進框內就好，不用對齊」 sits on top of the camera image. The card only has to be roughly inside the frame: the reader searches wide areas instead of fixed boxes. 相簿 loads a photo instead; it can be dragged (one pointer) and zoomed (two pointers or the mouse wheel). The camera is requested with the rear-camera constraints first and, on any error other than a refused permission, once more with plain `video: true`. Failures show the reason from the error name with 重試 (re-request) and 相簿 still available: NotAllowedError or SecurityError (permission refused; allow the camera in the site settings), NotFoundError (no camera), NotReadableError or AbortError (camera busy in another app), otherwise the raw error name; a browser without `getUserMedia` gets 「這個瀏覽器不支援相機，請改用 Safari 或 Chrome 開啟」 (typical for in-app browsers such as LINE), or a non-https note when `isSecureContext` is false.
- On capture the frame is mapped back to video or photo pixels (object-fit cover for the video, the transformed image box for photos), cropped to at most 1000px wide for OCR, and saved as a 630x880 JPEG.
- `ocr.js` (Tesseract.js 5, language data from jsDelivr, cached by the service worker in `ocr-cache`):
  - Number: one wide area would mix too many lines, so `CODE_BANDS` scans narrow overlapping strips over the left 65% of the bottom part (tops at 88%, 84%, 92%, 80%, 95%, each 7% high), upscaled 3x, with an `eng` worker in sparse-text mode and a letter and digit whitelist, each strip in grayscale and then Otsu-binarized (light-on-dark crops are inverted), stopping at the first three-digit number. When only a shorter number is read and the total has three digits (modern cards print 065/103), the number is left empty rather than guessed.
  - Name: the top 30% of the frame, tried as `chi_tra` sparse text, `chi_tra` single block, `jpn` sparse, `eng` sparse, stopping at the first match scoring 0.75 or more. Each worker is limited to the characters that occur in species names of its language (`NAME_WHITELIST`: 959 Chinese characters, 87 katakana), so OCR cannot invent characters such as 葛 that no name uses.
- `parse.js`: `parseCode` prefers `NNN/TTT` with a three-digit number (also when `/` was read as `|`, `l` or `I`), then shorter numbers, plus a rarity token after it (C, U, R, RR, RRR, AR, SAR, SR, UR, HR, ACE, PR) and a set-code-like token. `matchName` joins CJK characters that OCR split with spaces, compares each token with every species name (bigram Dice; for Chinese and Japanese also per-character overlap), prefers earlier tokens, needs 0.6 (0.8 for English), and returns nothing when the two best species are within 0.05 of each other (科斯莫 alone fits 科斯莫古 and 科斯莫姆 equally).
- Measured on the five sample photos with the frame matching the card, 15% larger, 10% smaller (card edges cut off) and shifted 8% right or down (25 reads, in Node with the same Tesseract models and preprocessing, because the hidden in-app browser pane pauses long OCR runs): number correct 14, wrong 2; name correct 8, wrong 2; 0.6 to 6 s per card on a desktop. The blurry photo fails every time. The confirm screen therefore always shows what was read and lets the user fix it.

## Editing and data

- `CardEditor.jsx`: set code, language (繁中 / 日文 / 英文), number, total, rarity, name with autocomplete from `names.json` in the chosen language, quantity. A new card starts from what OCR read and falls back to the last saved set code, total and language (`localStorage` key `lastSet`), so a pack of one set only needs the number. 儲存，繼續掃描 returns to the camera.
- `db.js` (Dexie, IndexedDB database `card-binder`): table `cards` with `lang`, `setCode`, `number` (3 digits), `total`, `rarity`, `name`, `dex`, `qty`, `tags`, `photo` (Blob), `createdAt` and `setKey` = `lang|setCode|total`. Saving a card whose set, number and rarity already exist adds to its quantity instead of a new entry.
- Backup (`Backup.jsx`): everything stays in the browser on this device. 匯出備份檔 downloads `card-binder-YYYY-MM-DD.json` with photos as data URLs; 匯入備份檔 replaces all cards after a confirmation. The page shows storage use and can ask the browser for persistent storage.
- `src/data/names.json`: `[dex, zh, ja, en]` for all 1025 species from PokeAPI `pokemon_species_names.csv` (zh-Hant, ja-Hrkt, en), built by `npm run data:names`.

## PWA

- `vite.config.js`: generated service worker with `skipWaiting`, `clientsClaim` and `navigateFallback`; `src/pwa.js` checks for updates on load, when the app becomes visible, on `pageshow` from bfcache and every 30 minutes, and reloads on `controllerchange` after the first install.

## Files

- `src/App.jsx`: view state and history (`binder`, `list`, `card`, `scan`, `edit`, `backup`)
- `src/components/Binder.jsx`, `BinderPages.jsx`, `ListView.jsx`, `CardDetail.jsx`, `CardEditor.jsx`, `Scanner.jsx`, `Backup.jsx`, `Photo.jsx`
- `src/ocr.js`, `src/parse.js`, `src/db.js`, `src/useLive.js`, `src/pwa.js`
- `scripts/build-names.mjs`

## Commands

```bash
npm run dev
npm run build
npm run data:names
```
