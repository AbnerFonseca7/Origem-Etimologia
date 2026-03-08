import { get, set, keys, del, clear } from 'idb-keyval';
import { EtymologyData } from './gemini';

const CACHE_STORE_NAME = 'etymology-cache';

export const CacheService = {
  /**
   * Get a cached etymology by word
   */
  async get(word: string): Promise<EtymologyData | null> {
    try {
      const normalizedWord = word.trim().toLowerCase();
      const cached = await get<EtymologyData>(normalizedWord);
      return cached || null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  },

  /**
   * Save an etymology to cache
   */
  async save(data: EtymologyData): Promise<void> {
    try {
      const normalizedWord = data.word.trim().toLowerCase();
      await set(normalizedWord, data);
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  },

  /**
   * Get all cached words
   */
  async getAllWords(): Promise<string[]> {
    try {
      const allKeys = await keys();
      return allKeys as string[];
    } catch (error) {
      console.error('Error getting cache keys:', error);
      return [];
    }
  },

  /**
   * Remove a specific word from cache
   */
  async remove(word: string): Promise<void> {
    try {
      await del(word.trim().toLowerCase());
    } catch (error) {
      console.error('Error deleting from cache:', error);
    }
  },

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    try {
      await clear();
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
};
