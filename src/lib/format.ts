import type { Locale } from '@/data/types';

const intl: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

export const formatNumber = (n: number, locale: Locale, digits = 0) =>
  new Intl.NumberFormat(intl[locale], { maximumFractionDigits: digits }).format(n);

/** Ratio for humans: 3.2 → "3.2", 0.31 → "0.31" */
export const formatRatio = (r: number, locale: Locale) =>
  formatNumber(r, locale, r >= 10 ? 1 : r >= 1 ? 2 : 3);

const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** Uzbek CLDR data is incomplete in many engines ("2026 M09 29"), so format it by hand. */
export const formatDate = (iso: string, locale: Locale) => {
  const d = new Date(iso);
  if (locale === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(intl[locale], { dateStyle: 'medium' }).format(d);
};
