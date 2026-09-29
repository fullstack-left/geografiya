/**
 * Hand-curated list of physical features for the "Rivers, Peaks, Lakes" game.
 *
 * `qid` pins the exact Wikidata item (names are ambiguous: there are 30+
 * "Crater Lake"s). `ref` is the widely published reference value used only to
 * VALIDATE Wikidata: Wikidata often stores several values (e.g. Caspian Sea
 * depth 211 m = mean and 1025 m = max), so the pipeline picks the Wikidata
 * value closest to `ref` and falls back to `ref` (with a warning) when none is
 * within tolerance.
 *
 * Rivers are measured as the named river itself (not the whole river system):
 * Mississippi 3,766 km, not Mississippi–Missouri 6,275 km.
 */
export type FeatureKind = 'river' | 'mountain' | 'lake';

export interface CuratedFeature {
  qid: string;
  kind: FeatureKind;
  /** River length km | mountain elevation m | lake max depth m */
  ref: number;
  /** Lakes only: surface area km² */
  refArea?: number;
  /** Uzbek name when Wikidata has no uz label. */
  uz?: string;
}

const river = (qid: string, ref: number): CuratedFeature => ({ qid, kind: 'river', ref });
const mountain = (qid: string, ref: number): CuratedFeature => ({ qid, kind: 'mountain', ref });
const lake = (qid: string, ref: number, refArea: number): CuratedFeature => ({ qid, kind: 'lake', ref, refArea });

export const CURATED_FEATURES: CuratedFeature[] = [
  // ---- rivers (length, km)
  river('Q3392', 6650), // Nile
  river('Q3783', 6400), // Amazon
  river('Q5413', 6300), // Yangtze
  river('Q7355', 5464), // Yellow River
  river('Q127892', 4880), // Paraná
  river('Q3503', 4700), // Congo
  river('Q41179', 4350), // Mekong
  river('Q46841', 4294), // Lena
  river('Q128102', 4248), // Irtysh
  river('Q3542', 4180), // Niger
  river('Q1497', 3766), // Mississippi
  river('Q5419', 3726), // Missouri
  river('Q973', 3650), // Ob
  river('Q626', 3530), // Volga
  river('Q78707', 3487), // Yenisei
  river('Q104437', 3190), // Yukon
  river('Q7348', 3180), // Indus
  river('Q160636', 3051), // Rio Grande
  river('Q45403', 2900), // Brahmaputra
  river('Q1653', 2850), // Danube
  river('Q6862', 2824), // Amur
  river('Q34589', 2800), // Euphrates
  river('Q8493', 2620), // Amu Darya (incl. Panj)
  river('Q43106', 2574), // Zambezi
  river('Q5089', 2525), // Ganges
  river('Q183078', 2508), // Murray
  river('Q80240', 2428), // Ural
  river('Q1265', 2334), // Colorado
  river('Q40855', 2285), // Dnieper
  river('Q483159', 2212), // Syr Darya
  river('Q131792', 2140), // Orinoco
  river('Q1229', 1870), // Don
  river('Q35591', 1850), // Tigris
  river('Q3411', 1738), // Mackenzie
  river('Q584', 1233), // Rhine
  river('Q1644', 1094), // Elbe
  river('Q548', 1047), // Vistula
  river('Q1469', 1006), // Loire
  river('Q19686', 346), // Thames

  // ---- mountains (elevation, m)
  mountain('Q513', 8849), // Everest
  mountain('Q43512', 8611), // K2
  mountain('Q82019', 8586), // Kangchenjunga
  mountain('Q168702', 8516), // Lhotse
  mountain('Q169986', 8485), // Makalu
  { ...mountain('Q170089', 8188), uz: 'Cho-Oyu' }, // Cho Oyu
  { ...mountain('Q165440', 8167), uz: 'Dxaulagiri' }, // Dhaulagiri
  mountain('Q170070', 8163), // Manaslu
  mountain('Q130736', 8126), // Nanga Parbat
  mountain('Q41413', 7495), // Ismoil Somoni
  mountain('Q332762', 7439), // Jengish Chokusu
  { ...mountain('Q838587', 7134), uz: 'Lenin cho‘qqisi' }, // Lenin Peak
  mountain('Q211529', 7010), // Khan Tengri
  mountain('Q39739', 6961), // Aconcagua
  { ...mountain('Q233836', 6893), uz: 'Oxos-del-Salado' }, // Ojos del Salado
  { ...mountain('Q14081', 6263), uz: 'Chimboraso' }, // Chimborazo
  mountain('Q120306', 5959), // Logan
  mountain('Q7296', 5895), // Kilimanjaro
  mountain('Q43105', 5642), // Elbrus
  mountain('Q238147', 5636), // Pico de Orizaba
  mountain('Q40758', 5610), // Damavand
  { ...mountain('Q172070', 5199), uz: 'Keniya tog‘i' }, // Mount Kenya
  mountain('Q72303', 5137), // Ararat
  mountain('Q207680', 5054), // Kazbek
  { ...mountain('Q17189941', 4892), uz: 'Vinson massivi' }, // Vinson
  { ...mountain('Q1045888', 4884), uz: 'Punchak-Jaya' }, // Puncak Jaya
  mountain('Q583', 4806), // Mont Blanc
  mountain('Q519822', 4643), // Hazrati Sulton (Uzbekistan)
  { ...mountain('Q1374', 4478), uz: 'Matterxorn' }, // Matterhorn
  { ...mountain('Q235539', 4421), uz: 'Uitni tog‘i' }, // Whitney
  { ...mountain('Q194057', 4392), uz: 'Reynir tog‘i' }, // Rainier
  mountain('Q60967', 4095), // Kinabalu
  mountain('Q39231', 3776), // Fuji
  { ...mountain('Q5059', 3724), uz: 'Kuk tog‘i (Aoraki)' }, // Aoraki / Mount Cook
  mountain('Q16990', 3357), // Etna (varies with eruptions)
  { ...mountain('Q3375', 2962), uz: 'Sugshpitse' }, // Zugspitze
  mountain('Q80344', 2918), // Olympus
  mountain('Q178167', 2228), // Kosciuszko

  // ---- lakes (max depth m, area km²)
  lake('Q5513', 1642, 31500), // Baikal
  lake('Q5511', 1470, 32900), // Tanganyika
  lake('Q5484', 1025, 371000), // Caspian Sea
  lake('Q5532', 706, 29600), // Malawi
  lake('Q42191', 668, 6236), // Issyk-Kul
  lake('Q5539', 614, 27200), // Great Slave
  { ...lake('Q329266', 594, 53), uz: 'Krater ko‘li' }, // Crater Lake
  lake('Q183360', 505, 1130), // Toba
  { ...lake('Q169962', 501, 490), uz: 'Taho ko‘li' }, // Tahoe
  lake('Q5525', 446, 31000), // Great Bear
  { ...lake('Q15523', 410, 146), uz: 'Komo ko‘li' }, // Como
  lake('Q1066', 406, 82100), // Superior
  { ...lake('Q6414', 346, 370), uz: 'Garda ko‘li' }, // Garda
  lake('Q6403', 310, 580), // Geneva
  lake('Q1169', 281, 57800), // Michigan
  lake('Q35342', 281, 8372), // Titicaca
  lake('Q49650', 230, 56), // Loch Ness (≈227–230)
  lake('Q1062', 244, 18960), // Ontario
  lake('Q4127', 251, 536), // Constance
  lake('Q1383', 229, 59600), // Huron
  lake('Q15288', 230, 17700), // Ladoga
  lake('Q166162', 127, 9700), // Onega
  { ...lake('Q182719', 109, 6405), uz: 'Turkana ko‘li' }, // Turkana
  lake('Q173596', 106, 5650), // Vänern
  lake('Q5505', 81, 68800), // Victoria
  lake('Q5492', 64, 25700), // Erie
  lake('Q3272', 36, 24500), // Winnipeg
  lake('Q134485', 26, 16400), // Balkhash
];
