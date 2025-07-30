import { locales, type Locale } from './config';

// 获取用户首选语言
export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'zh'; // 服务端默认返回中文
  }

  // 从 localStorage 获取用户设置的语言
  const savedLocale = localStorage.getItem('locale') as Locale;
  if (savedLocale && locales.includes(savedLocale)) {
    return savedLocale;
  }

  // 从浏览器语言设置获取
  const browserLocale = navigator.language.split('-')[0] as Locale;
  if (browserLocale && locales.includes(browserLocale)) {
    return browserLocale;
  }

  return 'zh'; // 默认中文
}

// 设置用户语言偏好
export function setPreferredLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
}

// 获取翻译消息
export async function getMessages(locale: Locale) {
  try {
    const messages = await import(`./locales/${locale}.json`);
    return messages.default;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // 回退到默认语言
    const defaultMessages = await import(`./locales/zh.json`);
    return defaultMessages.default;
  }
} 