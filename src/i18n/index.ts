import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uz from './locales/uz';
import ru from './locales/ru';
import en from './locales/en';
import { useSettings } from '@/stores/settings';

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: useSettings.getState().locale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

const sync = (lng: string) => {
  void i18n.changeLanguage(lng);
  document.documentElement.lang = lng;
};
sync(useSettings.getState().locale);
useSettings.subscribe((s, prev) => {
  if (s.locale !== prev.locale) sync(s.locale);
});

export default i18n;
