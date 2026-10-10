# Card Binder

[繁體中文](README.zh-TW.md) | [Architecture](docs/ARCHITECTURE.md)

A mobile-first PWA for keeping track of your physical Pokémon TCG cards. Photograph a card inside the on-screen frame, confirm the set, number and name that were read, and it goes into a binder with a fixed pocket for every card number, so you can see what you own, what is missing and what you have twice.

- The card is found and straightened automatically, and its number, rarity, Pokédex number and name are read on the device with PaddleOCR; nothing is uploaded and nothing needs to be aligned
- Binders per set, plus views by rarity, your own tags and per Pokémon
- Traditional Chinese, Japanese and English cards
- All data stays in your browser; export and import a backup file to move it to another phone

## Development

```bash
npm install
npm run dev
npm run build
```

## Credits

- Pokémon names: [PokeAPI](https://pokeapi.co/)
- OCR: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv6 models (Apache-2.0, see `public/models/`) via [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) and [ONNX Runtime Web](https://onnxruntime.ai/)

Pokémon and Pokémon card names and images are trademarks of Nintendo, Creatures, GAME FREAK and The Pokémon Company. This is an unofficial fan project.

## License

MIT
