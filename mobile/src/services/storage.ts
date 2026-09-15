import AsyncStorage from '@react-native-async-storage/async-storage';
import { PriorityRule, VipPerson, AppSettings } from '../types';

const STORAGE_KEYS = {
  RULES: '@prioritymail_rules_v1',
  VIP_PEOPLE: '@prioritymail_vip_people_v1',
  SETTINGS: '@prioritymail_settings_v1',
  COMPLETED_EMAILS: '@prioritymail_completed_emails_v1',
  SNOOZED_EMAILS: '@prioritymail_snoozed_emails_v1',
};

// In-memory fallback in case native AsyncStorage has issues
const memoryCache: Record<string, string> = {};

async function getItemSafe(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      memoryCache[key] = value;
      return value;
    }
    return memoryCache[key] ?? null;
  } catch (err) {
    console.warn(`AsyncStorage.getItem failed for ${key}, using memory cache`, err);
    return memoryCache[key] ?? null;
  }
}

async function setItemSafe(key: string, value: string): Promise<void> {
  memoryCache[key] = value;
  try {
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    console.warn(`AsyncStorage.setItem failed for ${key}`, err);
  }
}

export const StorageService = {
  async getRules(defaultRules: PriorityRule[]): Promise<PriorityRule[]> {
    const raw = await getItemSafe(STORAGE_KEYS.RULES);
    if (!raw) return defaultRules;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultRules;
    } catch {
      return defaultRules;
    }
  },

  async saveRules(rules: PriorityRule[]): Promise<void> {
    await setItemSafe(STORAGE_KEYS.RULES, JSON.stringify(rules));
  },

  async getVipPeople(defaultPeople: VipPerson[]): Promise<VipPerson[]> {
    const raw = await getItemSafe(STORAGE_KEYS.VIP_PEOPLE);
    if (!raw) return defaultPeople;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultPeople;
    } catch {
      return defaultPeople;
    }
  },

  async saveVipPeople(people: VipPerson[]): Promise<void> {
    await setItemSafe(STORAGE_KEYS.VIP_PEOPLE, JSON.stringify(people));
  },

  async getSettings(defaultSettings: AppSettings): Promise<AppSettings> {
    const raw = await getItemSafe(STORAGE_KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    try {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await setItemSafe(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  async getCompletedEmailIds(): Promise<string[]> {
    const raw = await getItemSafe(STORAGE_KEYS.COMPLETED_EMAILS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async saveCompletedEmailIds(ids: string[]): Promise<void> {
    await setItemSafe(STORAGE_KEYS.COMPLETED_EMAILS, JSON.stringify(ids));
  },

  async getSnoozedEmails(): Promise<Record<string, string>> {
    const raw = await getItemSafe(STORAGE_KEYS.SNOOZED_EMAILS);
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  },

  async saveSnoozedEmails(snoozed: Record<string, string>): Promise<void> {
    await setItemSafe(STORAGE_KEYS.SNOOZED_EMAILS, JSON.stringify(snoozed));
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
    } catch (err) {
      console.warn('Error clearing storage', err);
    }
    for (const k of Object.keys(memoryCache)) {
      delete memoryCache[k];
    }
  },
};
