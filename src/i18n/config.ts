import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

// Supported languages
export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

// Default language
export const defaultLocale: Locale = 'zh';

export default getRequestConfig(async ({ locale }) => {
  // Check if language is supported
  if (!locale || !locales.includes(locale as Locale)) notFound();

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default
  };
}); 