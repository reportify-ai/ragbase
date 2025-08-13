"use client";

import { useState, useEffect } from 'react';
import { getPreferredLocale, getMessages, setPreferredLocale } from './utils';
import { type Locale } from './config';

export function useTranslations() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [messages, setMessages] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      const currentLocale = getPreferredLocale();
      setLocale(currentLocale);
      
      try {
        const msgs = await getMessages(currentLocale);
        setMessages(msgs);
      } catch (error) {
        console.error('Failed to load messages:', error);
        // Fallback to Chinese
        const zhMessages = await getMessages('zh');
        setMessages(zhMessages);
        setLocale('zh');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  const t = (key: string, params?: Record<string, any>) => {
    if (!messages || loading) {
      // Return placeholder while loading to avoid showing key
      return '...';
    }

    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // If translation not found, return key name
      }
    }

    if (typeof value === 'string') {
      // Handle parameter replacement
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, param) => {
          return params[param] !== undefined ? String(params[param]) : match;
        });
      }
      return value;
    }

    return key;
  };

  const changeLocale = async (newLocale: Locale) => {
    setPreferredLocale(newLocale);
    setLocale(newLocale);
    
    try {
      const msgs = await getMessages(newLocale);
      setMessages(msgs);
    } catch (error) {
      console.error('Failed to load messages for new locale:', error);
    }
  };

  return { t, locale, changeLocale, loading };
} 