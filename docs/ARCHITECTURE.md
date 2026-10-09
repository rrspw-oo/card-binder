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

- `Scanner.jsx`: rear camera (`getUserMedia`, ideal 1920x1080) under a card-shaped frame (63:88, `min(80vw, (100dvh - 200px) * 63 / 88)`) with the rest dimmed. Inside the frame, a solid box marks the card number area (`CODE_REGION`) and a dashed box the name area (`NAME_REGION`). 相簿 loads a photo instead; it can be dragged (one pointer) and zoomed (two pointers or the mouse wheel) until the card fits the frame. Without camera access the hint says so and 相簿 still works.
- On capture the frame is mapped back to video or photo pixels (object-fit cover for the video, the transformed image box for photos), cropped to at most 1000px wide for OCR, and saved as a 630x880 JPEG.
- `ocr.js` (Tesseract.js 5, language data from jsDelivr, cached by the service worker in `ocr-cache`): the number area (x 2%-47%, y 90%-97.5% of the card) is read by an `eng` worker with a letter and digit whitelist in sparse-text mode, first in grayscale, then Otsu-binarized; light-on-dark crops are inverted. The name area (x 15%-75%, y 2.5%-7.5%) is read with `chi_tra`, then `jpn`, then `eng`, stopping at the first confident match.
- `parse.js`: `parseCode` takes `NNN/TTT` (also when `/` was read as `|`, `l` or `I`), a rarity token after it (C, U, R, RR, RRR, AR, SAR, SR, UR, HR, ACE, PR) and a set-code-like token. `matchName` joins CJK characters that OCR split with spaces, compares each token with every species name (bigram Dice; for Chinese and Japanese also per-character overlap), prefers earlier tokens, and needs 0.6 (0.8 for English) to return a match.
- Measured on the five sample photos (desktop browser, cards cropped to their edges): number correct on 3 of 5, name on 1 of 5; a blurry photo and a dark card shot at an angle fail. The confirm screen therefore always shows what was read and lets the user fix it.

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
