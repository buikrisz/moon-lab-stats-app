# Pilates Studio Next.js App

Next.js + TypeScript + MongoDB Atlas verzió Vercel deployhoz.

## Indítás lokálisan

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Vercel + MongoDB Atlas

1. MongoDB Atlasban hozz létre clustert.
2. Database Access: hozz létre egy DB usert.
3. Network Access: indulásnak engedélyezheted `0.0.0.0/0`-t.
4. Másold ki a connection stringet.
5. Vercel Project → Settings → Environment Variables:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `STUDIO_ID`
6. Deploy.

## Adattárolás

Az app egy MongoDB dokumentumban tárolja az állapotot:

```txt
collection: appData
filter: { studioId: process.env.STUDIO_ID }
field: data
```

A kliens minden szerkesztés után `PUT /api/data` hívással MongoDB-be ment.


## Calendar logic

- Új hét létrehozásakor csak hétfő választható kezdőnapnak.
- A hét neve automatikusan generálódik hétfőtől vasárnapig, de szerkeszthető.
- Heti kimutatásban Teljes / Év / Hónap nézet van.
- Havi nézet naptár szerinti átfedéssel szűr, tehát egy hónap közepén átlógó hét is megjelenik.
