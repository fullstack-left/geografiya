# GeoMaster

Geografiya o'yinlari platformasi. React 19 + TypeScript (strict) + Vite + Tailwind v4 + TanStack Router/Query + Zustand + Framer Motion + D3-geo.

```bash
npm install
npm run dev          # dev server
npm test             # Vitest (bir marta ishga tushadi)
npm run build        # typecheck + production build
npm run data:fetch   # geografik ma'lumotlarni qayta yuklash (-- --fresh: keshsiz)
```

## Holat

| Bosqich | Holat |
|---|---|
| 1. Skelet, dizayn tizimi, routing, layout, i18n (uz/ru/en), dark/light | ✅ |
| 2. Ma'lumot yuklash skripti + versiyalangan JSON | ✅ |
| 3. «Maydonni solishtirish» (Area Scaler) | ✅ |
| 4. Qolgan o'yin rejimlari | ⏳ |
| 5. Auth, profil, reyting (Supabase) | ⏳ |
| 6. Statistika, yutuqlar, kunlik chaqiruv | ⏳ |
| 7. Sayqallash | qisman (ovoz, i18n, testlar bor) |

## Tuzilma

```
scripts/fetch-geo-data.ts         ma'lumot quvuri (bir marta ishga tushiriladi)
public/data/                      countries.v1.json, world-50m.v1.json, manifest.json
src/data/                         tiplar (types.ts) va TanStack Query hooklari
src/features/games/<game>/        har bir o'yin mustaqil modul
  area-scaler/
    scoring.ts   geometry.ts   pairs.ts   state.ts   ← sof mantiq (testlangan)
    components/, AreaScalerGame.tsx, AreaScalerPage.tsx ← UI
src/components, src/pages, src/i18n, src/stores, src/lib
```

## Ma'lumotlar

| Ma'lumot | Manba |
|---|---|
| Nomlar, poytaxtlar, chegaralar, mintaqa, status | [mledoze/countries](https://github.com/mledoze/countries) — REST Countries shu datasetga asoslangan. REST Countries v1–v4 2026-yilda o'chirildi, v5 esa API kalit talab qiladi |
| Maydon, aholi | World Bank API (`AG.SRF.TOTL.K2`, `SP.POP.TOTL`) |
| O'zbekcha/ruscha nomlar, maydon (P2046) | Wikidata SPARQL |
| Konturlar | Natural Earth 1:50m (`world-atlas@2`), id'lar ISO alpha-3 ga o'tkazilgan |

**Maydonni tekshirish.** World Bank qiymati boshqa kamida bitta manba (±2%) bilan tasdiqlansagina ishlatiladi. Aks holda boshqa manbalar kelishgan qiymat, bo'lmasa mediana olinadi. Sababi: World Bank seriyasida ba'zi davlatlarning ko'rsatkichiga hududiy suvlar ham kiritilgan (Kanada 15.6 mln km², Xorvatiya 88 ming km²). Har bir qaror `manifest.json → warnings` da yozib boriladi. Har bir qiymat uchun manba va yil saqlanadi.

**Status:** `sovereign` | `partial` (Kosovo, Tayvan, Falastin, G'arbiy Sahroi Kabir) | `territory` (Grenlandiya, Gonkong …). Sozlamalarda yoqib-o'chiriladi.

## Area Scaler

- Har bir davlat o'z markaziga qaratilgan **Lambert azimutal teng maydonli** proyeksiyada chiziladi. Ikkala panel bir xil px/km masshtabda turadi, masshtab chizig'i ham bor.
- `accuracy = max(0, 100 − |ln(userRatio / trueRatio)| × 100)`.
- `trueRatio` ekranda ko'rsatilgan kontur maydonidan hisoblanadi. Uzoqdagi dengizorti hududlar (Fransiya Gvianasi, Gavayi) konturga kiritilmaydi. Rasmiy maydon natija ekranida alohida ko'rsatiladi.
- Natural Earth'dagi konturi rasmiy maydondan 15% dan ko'p farq qiladigan davlatlar (bahsli chegaralar: Marokash, Somali) o'yinga qo'shilmaydi.
- Boshqaruv: slider, sichqoncha g'ildiragi, pinch, `←/→`, `+/−`, `Enter`.
