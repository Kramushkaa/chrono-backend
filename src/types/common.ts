// Общие типы для всего приложения

/**
 * Метаданные пагинации (соответствует выводу paginateRows из utils/api)
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}

/**
 * Ответ API с пагинацией
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Тип для значений SQL параметров
 */
export type SqlValue = string | number | boolean | null | Date;

/**
 * Неизвестный JSON объект
 */
export type JsonObject = Record<string, unknown>;

/**
 * Тип для ответов квиза (может быть разных типов)
 */
export type QuizAnswer = string | number | string[] | boolean | null;
