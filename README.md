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
| 4. Qolgan o'yin rejimlari (8 ta) | ✅ |
| 5. Auth, profil, reyting (Supabase) | ⏳ |
| 6. Statistika, yutuqlar, kunlik chaqiruv | qisman (kunlik chaqiruv va SRS tayyor, global reyting backendni kutyapti) |
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

## O'yin rejimlari

| Rejim | Modul | Mantiq (testlangan) |
|---|---|---|
| Maydonni solishtirish | `area-scaler/` | `scoring.ts`, `pairs.ts`, `state.ts` |
| Poytaxt viktorinasi, Bayroqni top, Shakl bo'yicha top | `capitals/`, `flags/`, `shapes/` → umumiy `quiz/` | `quiz/engine.ts` |
| Xaritada ko'rsat | `map-click/` | `logic.ts` |
| Yuqori / Past | `higher-lower/` | `logic.ts` |
| Chegaradoshlar zanjiri | `borders/` | `logic.ts` (BFS) |
| Daryolar, tog'lar, ko'llar | `features/` | `logic.ts` |
| Kunlik chaqiruv | `daily/` | `logic.ts` (UTC sana → seed) |

- **Spaced repetition** (`src/lib/srs.ts`, `src/stores/progress.ts`): Leitner qutilari. Noto'g'ri javob berilgan davlatlar keyingi o'yinlarda tez-tez so'raladi.
- **Adolatli savollar:** poytaxti bir xil davlatlar yoki bir-biriga juda o'xshash bayroqlar (Chad/Ruminiya, Indoneziya/Monako…) bitta savolda chiqmaydi. Yuqori/Past'da qiymatlari 5% dan kam farq qiladigan juftliklar, daryo/tog'/ko'l tartiblashda esa 8% dan kam farq qiladiganlar chiqmaydi. Chegaralar grafigiga faqat ikki tomonlama tasdiqlangan chegaralar kiradi.
- Kunlik chaqiruv foydalanuvchi sozlamalariga bog'liq emas: hammaga bir xil 10 ta savol beriladi (faqat suveren davlatlardan).

## Ma'lumotlar

| Ma'lumot | Manba |
|---|---|
| Nomlar, poytaxtlar, chegaralar, mintaqa, status | [mledoze/countries](https://github.com/mledoze/countries) — REST Countries shu datasetga asoslangan. REST Countries v1–v4 2026-yilda o'chirildi, v5 esa API kalit talab qiladi |
| Maydon, aholi | World Bank API (`AG.SRF.TOTL.K2`, `SP.POP.TOTL`) |
| O'zbekcha/ruscha nomlar, maydon (P2046) | Wikidata SPARQL |
| Konturlar | Natural Earth 1:50m (`world-atlas@2`), id'lar ISO alpha-3 ga o'tkazilgan |
| YaIM | World Bank `NY.GDP.MKTP.CD` |
| Eng baland nuqtalar | Wikidata P610 + P2044 (USA, GMB uchun qo'lda kiritilgan qiymat) |
| Daryo/tog'/ko'llar | `scripts/curated-features.ts` (QID bo'yicha). Qiymatlar Wikidata'dan olinadi va ma'lumotnoma qiymatiga nisbatan ±5% ichida tekshiriladi |
| Bayroqlar | Flagpedia/flagcdn SVG, `public/flags/` ichida saqlangan |

**Maydonni tekshirish.** World Bank qiymati boshqa kamida bitta manba (±2%) bilan tasdiqlansagina ishlatiladi. Aks holda boshqa manbalar kelishgan qiymat, bo'lmasa mediana olinadi. Sababi: World Bank seriyasida ba'zi davlatlarning ko'rsatkichiga hududiy suvlar ham kiritilgan (Kanada 15.6 mln km², Xorvatiya 88 ming km²). Har bir qaror `manifest.json → warnings` da yozib boriladi. Har bir qiymat uchun manba va yil saqlanadi.

**Status:** `sovereign` | `partial` (Kosovo, Tayvan, Falastin, G'arbiy Sahroi Kabir) | `territory` (Grenlandiya, Gonkong …). Sozlamalarda yoqib-o'chiriladi.

## Area Scaler

- Har bir davlat o'z markaziga qaratilgan **Lambert azimutal teng maydonli** proyeksiyada chiziladi. Ikkala panel bir xil px/km masshtabda turadi, masshtab chizig'i ham bor.
- `accuracy = max(0, 100 − |ln(userRatio / trueRatio)| × 100)`.
- `trueRatio` ekranda ko'rsatilgan kontur maydonidan hisoblanadi. Uzoqdagi dengizorti hududlar (Fransiya Gvianasi, Gavayi) konturga kiritilmaydi. Rasmiy maydon natija ekranida alohida ko'rsatiladi.
- Natural Earth'dagi konturi rasmiy maydondan 15% dan ko'p farq qiladigan davlatlar (bahsli chegaralar: Marokash, Somali) o'yinga qo'shilmaydi.
- Boshqaruv: slider, sichqoncha g'ildiragi, pinch, `←/→`, `+/−`, `Enter`.
