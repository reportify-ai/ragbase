import { db } from './index';
import { systemSettings } from './schema';
import { eq } from 'drizzle-orm';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateSystemSettingData {
  key: string;
  value: string;
  description?: string;
}

export interface UpdateSystemSettingData {
  value: string;
  description?: string;
}

// Get all system settings
export async function getAllSystemSettings(): Promise<SystemSetting[]> {
  return await db.select().from(systemSettings).orderBy(systemSettings.key);
}

// Get system setting by key
export async function getSystemSetting(key: string): Promise<SystemSetting | null> {
  const [setting] = await db.select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  
  return setting || null;
}

// Get system setting value by key
export async function getSystemSettingValue(key: string): Promise<string | null> {
  const setting = await getSystemSetting(key);
  return setting ? setting.value : null;
}

// Get boolean system setting value
export async function getSystemSettingBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
  const value = await getSystemSettingValue(key);
  if (value === null) return defaultValue;
  return value === 'true';
}

// Create system setting
export async function createSystemSetting(data: CreateSystemSettingData): Promise<SystemSetting> {
  const [setting] = await db.insert(systemSettings).values({
    key: data.key,
    value: data.value,
    description: data.description,
    updated_at: new Date().toISOString(),
  }).returning();
  
  return setting;
}

// Update system setting
export async function updateSystemSetting(key: string, data: UpdateSystemSettingData): Promise<SystemSetting | null> {
  const [setting] = await db.update(systemSettings)
    .set({
      value: data.value,
      description: data.description,
      updated_at: new Date().toISOString(),
    })
    .where(eq(systemSettings.key, key))
    .returning();
  
  return setting || null;
}

// Upsert system setting (create if not exists, update if exists)
export async function upsertSystemSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
  const existing = await getSystemSetting(key);
  
  if (existing) {
    return await updateSystemSetting(key, { value, description }) as SystemSetting;
  } else {
    return await createSystemSetting({ key, value, description });
  }
}

// Delete system setting
export async function deleteSystemSetting(key: string): Promise<void> {
  await db.delete(systemSettings).where(eq(systemSettings.key, key));
}

// Import system setting keys from constants
export { SYSTEM_SETTING_KEYS } from '@/lib/constants';
