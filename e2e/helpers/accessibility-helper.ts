import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Хелперы для accessibility тестирования
 */

export interface A11yViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
}

export interface A11yResults {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  timestamp: string;
}

/**
 * Базовая проверка accessibility для страницы
 * 
 * @param page - Playwright Page
 * @param options - Опции для axe-core
 * @returns Результаты проверки
 */
export async function checkA11y(
  page: Page,
  options?: {
    disableRules?: string[];
    enableRules?: string[];
    wcagLevel?: 'A' | 'AA' | 'AAA';
  }
): Promise<A11yResults> {
  const axeBuilder = new AxeBuilder({ page });

  // Устанавливаем WCAG уровень (по умолчанию AA)
  const wcagLevel = options?.wcagLevel || 'AA';
  axeBuilder.withTags([`wcag2${wcagLevel.toLowerCase()}`, 'wcag21aa', 'best-practice']);

  // Отключаем правила если указаны
  if (options?.disableRules) {
    axeBuilder.disableRules(options.disableRules);
  }

  // Включаем дополнительные правила
  if (options?.enableRules) {
    options.enableRules.forEach((rule) => axeBuilder.include(rule));
  }

  const results = await axeBuilder.analyze();

  return {
    violations: results.violations as A11yViolation[],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Проверка accessibility с автоматическим логированием нарушений
 */
export async function assertA11y(
  page: Page,
  options?: {
    disableRules?: string[];
    maxViolations?: number;
    excludeImpact?: ('minor' | 'moderate' | 'serious' | 'critical')[];
  }
): Promise<void> {
  const results = await checkA11y(page, options);

  // Фильтруем нарушения по impact если указано
  let violations = results.violations;
  if (options?.excludeImpact) {
    violations = violations.filter(
      (v) => !options.excludeImpact?.includes(v.impact as any)
    );
  }

  if (violations.length > 0) {
    console.error(`\n❌ Найдено ${violations.length} accessibility нарушений:\n`);

    violations.forEach((violation, index) => {
      console.error(`\n${index + 1}. [${violation.impact?.toUpperCase()}] ${violation.id}`);
      console.error(`   Описание: ${violation.description}`);
      console.error(`   Помощь: ${violation.help}`);
      console.error(`   URL: ${violation.helpUrl}`);
      console.error(`   Затронуто элементов: ${violation.nodes.length}`);

      violation.nodes.forEach((node, nodeIndex) => {
        console.error(`   \n   Элемент ${nodeIndex + 1}:`);
        console.error(`   HTML: ${node.html.substring(0, 100)}...`);
        console.error(`   Селектор: ${node.target.join(' > ')}`);
        if (node.failureSummary) {
          console.error(`   Проблема: ${node.failureSummary}`);
        }
      });
    });

    console.error(`\n✅ Пройдено проверок: ${results.passes}`);
    console.error(`⚠️  Неполных проверок: ${results.incomplete}\n`);
  }

  // Если установлен максимум нарушений, проверяем
  if (options?.maxViolations !== undefined) {
    if (violations.length > options.maxViolations) {
      throw new Error(
        `Превышено максимальное количество accessibility нарушений: ${violations.length} > ${options.maxViolations}`
      );
    }
  } else if (violations.length > 0) {
    throw new Error(`Найдено ${violations.length} accessibility нарушений`);
  }
}

/**
 * Проверка keyboard navigation
 */
export async function checkKeyboardNavigation(
  page: Page,
  options?: {
    startSelector?: string;
    expectedStops?: number;
  }
): Promise<{ success: boolean; stopsCount: number; focusedElements: string[] }> {
  const focusedElements: string[] = [];
  let stopsCount = 0;

  // Начинаем с начала страницы или указанного элемента
  if (options?.startSelector) {
    await page.locator(options.startSelector).focus();
  } else {
    await page.keyboard.press('Tab');
  }

  // Проходим Tab через элементы (максимум 50 итераций)
  const maxIterations = options?.expectedStops || 50;
  
  for (let i = 0; i < maxIterations; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Получаем текущий фокус
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;

      return {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        class: el.className,
        type: (el as any).type || '',
      };
    });

    if (focusedElement) {
      const elementStr = `${focusedElement.tag}${focusedElement.id ? '#' + focusedElement.id : ''}${focusedElement.class ? '.' + focusedElement.class.split(' ')[0] : ''}`;
      focusedElements.push(elementStr);
      stopsCount++;
    }
  }

  return {
    success: stopsCount > 0,
    stopsCount,
    focusedElements,
  };
}

/**
 * Проверка цветового контраста
 */
export async function checkColorContrast(page: Page): Promise<A11yResults> {
  return await checkA11y(page, {
    enableRules: ['color-contrast'],
  });
}

/**
 * Проверка aria-labels и screen reader support
 */
export async function checkAriaLabels(page: Page): Promise<A11yResults> {
  const axeBuilder = new AxeBuilder({ page });
  axeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  axeBuilder.include(['aria-allowed-attr', 'aria-required-attr', 'aria-valid-attr-value']);

  const results = await axeBuilder.analyze();

  return {
    violations: results.violations as A11yViolation[],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Проверка focus management (для модальных окон и динамического контента)
 */
export async function checkFocusManagement(
  page: Page,
  triggerSelector: string,
  expectedFocusSelector: string
): Promise<boolean> {
  // Кликаем на триггер (например, кнопку открытия модалки)
  await page.locator(triggerSelector).click();
  await page.waitForTimeout(300);

  // Проверяем что фокус переместился
  const focusedElement = await page.evaluate((selector) => {
    const expectedEl = document.querySelector(selector);
    const activeEl = document.activeElement;
    return expectedEl === activeEl;
  }, expectedFocusSelector);

  return focusedElement;
}

/**
 * Проверка доступности форм
 */
export async function checkFormAccessibility(page: Page): Promise<A11yResults> {
  const axeBuilder = new AxeBuilder({ page });
  axeBuilder.withTags(['wcag2a', 'wcag2aa', 'best-practice']);
  axeBuilder.include(['label', 'form-field-multiple-labels', 'input-button-name']);

  const results = await axeBuilder.analyze();

  return {
    violations: results.violations as A11yViolation[],
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Генерация отчёта по accessibility
 */
export function generateA11yReport(results: A11yResults): string {
  const report: string[] = [];

  report.push('='.repeat(80));
  report.push('ACCESSIBILITY REPORT');
  report.push('='.repeat(80));
  report.push(`Timestamp: ${results.timestamp}`);
  report.push(`Violations: ${results.violations.length}`);
  report.push(`Passes: ${results.passes}`);
  report.push(`Incomplete: ${results.incomplete}`);
  report.push('');

  if (results.violations.length > 0) {
    report.push('VIOLATIONS:');
    report.push('-'.repeat(80));

    results.violations.forEach((violation, index) => {
      report.push(`\n${index + 1}. [${violation.impact?.toUpperCase()}] ${violation.id}`);
      report.push(`   ${violation.description}`);
      report.push(`   Help: ${violation.help}`);
      report.push(`   URL: ${violation.helpUrl}`);
      report.push(`   Affected: ${violation.nodes.length} element(s)`);
    });
  } else {
    report.push('✅ No accessibility violations found!');
  }

  report.push('\n' + '='.repeat(80));

  return report.join('\n');
}

