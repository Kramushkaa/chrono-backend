/**
 * Простой in-memory cache с TTL поддержкой
 */

interface CacheItem<T = any> {
  value: T;
  expiresAt: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem>();

  /**
   * Установить значение в кэш
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Получить значение из кэша
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Проверяем, не истек ли TTL
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
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
   * Получить размер кэша
   */
  size(): number {
    // Очищаем истекшие элементы перед подсчетом
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
  } {
    this.cleanup();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Создаем глобальный экземпляр кэша
export const cache = new SimpleCache();

// Экспортируем класс для тестирования
export { SimpleCache };
