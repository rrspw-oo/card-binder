import Dexie from "dexie";

export const db = new Dexie("card-binder");

db.version(1).stores({
  cards: "++id, setKey, dex, rarity, *tags, createdAt",
});

export const setKeyOf = (card) => `${card.lang}|${card.setCode}|${card.total || ""}`;

export const photoBlob = (photo) => (photo instanceof Blob ? photo : new Blob([photo], { type: "image/jpeg" }));

const storedPhoto = async (photo) => (photo instanceof Blob ? photo.arrayBuffer() : photo);

export async function saveCard(card) {
  const setKey = setKeyOf(card);
  const same = await db.cards
    .where("setKey")
    .equals(setKey)
    .filter((c) => c.number === card.number && c.rarity === card.rarity)
    .first();
  if (same && !card.id) {
    await db.cards.update(same.id, { qty: same.qty + (card.qty || 1) });
    return { id: same.id, merged: true };
  }
  const record = { tags: [], qty: 1, createdAt: Date.now(), ...card, photo: await storedPhoto(card.photo), setKey };
  const id = await db.cards.put(record);
  return { id, merged: false };
}

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

export async function exportBackup() {
  const cards = await db.cards.toArray();
  const out = [];
  for (const card of cards) out.push({ ...card, photo: card.photo ? await blobToDataUrl(photoBlob(card.photo)) : null });
  return new Blob([JSON.stringify({ app: "card-binder", version: 1, exportedAt: new Date().toISOString(), cards: out })], {
    type: "application/json",
  });
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== "card-binder" || !Array.isArray(data.cards)) throw new Error("不是 Card Binder 的備份檔");
  const cards = [];
  for (const card of data.cards) {
    const photo = card.photo ? await (await fetch(card.photo)).arrayBuffer() : null;
    cards.push({ ...card, photo });
  }
  await db.transaction("rw", db.cards, async () => {
    await db.cards.clear();
    await db.cards.bulkPut(cards);
  });
  return cards.length;
}
