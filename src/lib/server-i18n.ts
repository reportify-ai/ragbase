import { type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/utils';

/**
 * Server-side translation utility
 * Provides i18n support for API routes and server-side code
 */
export class ServerI18n {
  private messages: any = {};
  private locale: Locale = 'en';

  constructor(locale: Locale = 'en') {
    this.locale = locale;
  }

  /**
   * Initialize messages for the specified locale
   */
  async init() {
    this.messages = await getMessages(this.locale);
  }

  /**
   * Get translated text by key path
   * @param keyPath - Dot notation key path (e.g., 'api.errors.kbIdRequired')
   * @param params - Optional parameters for string interpolation
   */
  t(keyPath: string, params?: Record<string, string | number>): string {
    const keys = keyPath.split('.');
    let value = this.messages;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        // Return the key if translation not found
        console.warn(`Translation not found for key: ${keyPath}`);
        return keyPath;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${keyPath}`);
      return keyPath;
    }

    // Replace parameters in the string
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key]?.toString() || match;
      });
    }

    return value;
  }
}

/**
 * Get locale from request headers
 * Checks Accept-Language header or falls back to default
 */
export function getLocaleFromRequest(request: Request): Locale {
  try {
    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
      // Parse Accept-Language header (e.g., "zh-CN,zh;q=0.9,en;q=0.8")
      const languages = acceptLanguage
        .split(',')
        .map(lang => lang.trim().split(';')[0].split('-')[0]) // Extract main language code
        .filter(lang => ['en', 'zh'].includes(lang)); // Only support en and zh
      
      if (languages.length > 0) {
        return languages[0] as Locale;
      }
    }
  } catch (error) {
    console.warn('Error parsing Accept-Language header:', error);
  }
  
  return 'en'; // Default fallback
}

/**
 * Create a server-side translator instance
 * @param request - Request object to extract locale from
 */
export async function createServerTranslator(request: Request): Promise<ServerI18n> {
  const locale = getLocaleFromRequest(request);
  const translator = new ServerI18n(locale);
  await translator.init();
  return translator;
}

/**
 * Quick translation function for API routes
 * @param request - Request object
 * @param keyPath - Translation key path
 * @param params - Optional parameters
 */
export async function serverT(
  request: Request, 
  keyPath: string, 
  params?: Record<string, string | number>
): Promise<string> {
  const translator = await createServerTranslator(request);
  return translator.t(keyPath, params);
}
