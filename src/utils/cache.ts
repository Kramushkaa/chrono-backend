import crypto from 'crypto';

/**
 * Простой in-memory cache с TTL поддержкой и вспомогательными метаданными
 */

export interface CacheMetadata {
  etag?: string;
  ttlMs?: number;
  generatedAt?: string;
  [key: string]: unknown;
}

interface CacheItem<T = any> {
  value: T;
  expiresAt: number;
  metadata?: CacheMetadata;
}

class SimpleCache {
  private cache = new Map<string, CacheItem>();

  /**
   * Установить значение в кэш
   */
  set<T>(key: string, value: T, ttlMs: number, metadata?: CacheMetadata): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, {
      value,
      expiresAt,
      metadata: {
        ttlMs,
        ...metadata,
      },
    });
  }

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    if (!entry) {
      return null;
    }
    return entry.value as T;
  }

  /**
   * Получить полную запись из кэша
   */
  getEntry<T>(key: string): CacheItem<T> | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item as CacheItem<T>;
  }

  /**
   * Удалить конкретный ключ из кэша
   */
  clear(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Очистить весь кэш
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Количество валидных записей в кэше
   */
  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  /**
   * Очистка истекших элементов
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Получить статистику кэша
   */
  getStats(): {
    size: number;
    keys: string[];
    entries: Array<{
      key: string;
      expiresInMs: number;
      metadata?: CacheMetadata;
    }>;
  } {
    this.cleanup();
    const now = Date.now();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries: Array.from(this.cache.entries()).map(([key, item]) => ({
        key,
        expiresInMs: Math.max(item.expiresAt - now, 0),
        metadata: item.metadata,
      })),
    };
  }

  /**
   * Утилита для вычисления ETag
   */
  computeEtag(payload: unknown): string {
    return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }
}

// Создаем глобальный экземпляр кэша
export const cache = new SimpleCache();

// Экспортируем класс для тестирования
export { SimpleCache };
