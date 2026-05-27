import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

i18n
  .use(initReactI18next)
  .init({
    load: 'languageOnly',
    resources: { en },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en'],
    interpolation: { escapeValue: false },
  });

export default i18n;
