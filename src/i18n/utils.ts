import { locales, type Locale } from './config';

// Get user's preferred language
export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en'; // Default to English on server side
  }

  // Get user language from localStorage
  const savedLocale = localStorage.getItem('locale') as Locale;
  if (savedLocale && locales.includes(savedLocale)) {
    return savedLocale;
  }

  // Get from browser language settings
  const browserLocale = navigator.language.split('-')[0] as Locale;
  if (browserLocale && locales.includes(browserLocale)) {
    return browserLocale;
  }

  return 'en'; // Default to English
}

// Set user language preference
export function setPreferredLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
}

// Get translation messages
export async function getMessages(locale: Locale) {
  try {
    const messages = await import(`./locales/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // Fallback to default language
    const defaultMessages = await import(`./locales/en.json`);
    return defaultMessages.default;
  }
} 