/**
 * Утилита для динамического построения SQL WHERE условий
 * Устраняет дублирование в periodsRoutes и achievementsRoutes
 */

export type SqlOperator =
  | '='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'ILIKE'
  | 'IN'
  | 'IS NULL'
  | 'IS NOT NULL';

type FilterValue = string | number | boolean | null | (string | number | boolean)[];

interface FilterCondition {
  field: string;
  value: FilterValue;
  operator: SqlOperator;
}

export class QueryBuilder {
  private conditions: FilterCondition[] = [];
  private paramIndex: number = 1;

  /**
   * Добавляет фильтр к WHERE условию
   * @param field - Название поля в БД
   * @param value - Значение для фильтрации
   * @param operator - SQL оператор (по умолчанию '=')
   */
  addFilter(field: string, value: FilterValue | undefined, operator: SqlOperator = '='): this {
    if (value === undefined || value === null || value === '') {
      return this;
    }

    this.conditions.push({ field, value, operator });
    return this;
  }

  /**
   * Добавляет поисковой фильтр по нескольким полям (ILIKE)
   * @param fields - Массив полей для поиска
   * @param searchTerm - Поисковый запрос
   */
  addSearch(fields: string[], searchTerm: string): this {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this;
    }

    const term = searchTerm.trim();
    // Для поиска создаём специальное условие с OR
    this.conditions.push({
      field: `(${fields.map(f => `${f} ILIKE $${this.paramIndex}`).join(' OR ')})`,
      value: `%${term}%`,
      operator: '=' as SqlOperator, // Трюк: operator не используется для этого типа
    });

    return this;
  }

  /**
   * Добавляет числовой фильтр (проверяет, что значение - число)
   * @param field - Название поля
   * @param value - Числовое значение
   * @param operator - Оператор сравнения
   */
  addNumericFilter(
    field: string,
    value: string | number | undefined,
    operator: SqlOperator = '='
  ): this {
    if (value === undefined || value === null || value === '') {
      return this;
    }

    const numValue = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (!Number.isInteger(numValue)) {
      return this;
    }

    this.conditions.push({ field, value: numValue, operator });
    return this;
  }

  /**
   * Строит SQL WHERE условие и массив параметров
   * @param baseWhere - Базовое WHERE условие (например, "1=1" или "status = 'approved'")
   * @returns Объект с sql (WHERE часть) и params (значения для $1, $2, etc.)
   */
  build(baseWhere: string = '1=1'): { whereClause: string; params: (string | number | boolean)[] } {
    const params: (string | number | boolean)[] = [];
    let whereClause = baseWhere;

    for (const condition of this.conditions) {
      // Специальная обработка для поисковых условий (уже содержат OR)
      if (condition.field.includes(' OR ')) {
        whereClause += ` AND ${condition.field}`;
        params.push(condition.value as string | number | boolean);
        this.paramIndex++;
      } else if (condition.operator === 'IN') {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        const placeholders = values.map(() => `$${this.paramIndex++}`).join(', ');
        whereClause += ` AND ${condition.field} IN (${placeholders})`;
        params.push(...(values as Array<string | number | boolean>));
      } else if (condition.operator === 'IS NULL' || condition.operator === 'IS NOT NULL') {
        whereClause += ` AND ${condition.field} ${condition.operator}`;
      } else if (condition.operator === 'LIKE' || condition.operator === 'ILIKE') {
        whereClause += ` AND ${condition.field} ${condition.operator} $${this.paramIndex}`;
        params.push(condition.value as string | number | boolean);
        this.paramIndex++;
      } else {
        whereClause += ` AND ${condition.field} ${condition.operator} $${this.paramIndex}`;
        params.push(condition.value as string | number | boolean);
        this.paramIndex++;
      }
    }

    return { whereClause, params };
  }

  /**
   * Возвращает текущий индекс параметра (полезно для добавления LIMIT/OFFSET)
   */
  getNextParamIndex(): number {
    return this.paramIndex;
  }

  /**
   * Сбрасывает построитель
   */
  reset(): this {
    this.conditions = [];
    this.paramIndex = 1;
    return this;
  }
}

/**
 * Хелпер для быстрого создания фильтрованного запроса
 */
export function buildFilteredQuery(
  baseQuery: string,
  filters: Record<string, FilterValue | undefined>,
  searchFields?: { fields: string[]; term: string }
): { sql: string; params: (string | number | boolean)[] } {
  const builder = new QueryBuilder();

  // Добавляем поисковые поля
  if (searchFields && searchFields.term) {
    builder.addSearch(searchFields.fields, searchFields.term);
  }

  // Добавляем остальные фильтры
  for (const [field, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      builder.addFilter(field, value);
    }
  }

  const { whereClause, params } = builder.build();
  const sql = baseQuery.replace(/WHERE 1=1/, `WHERE ${whereClause}`);

  return { sql, params };
}
