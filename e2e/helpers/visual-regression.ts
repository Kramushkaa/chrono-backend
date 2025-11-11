import { Page, Locator, expect } from '@playwright/test';

/**
 * Хелперы для visual regression тестирования
 */

export interface SnapshotOptions {
  /**
   * Имя снапшота (без расширения)
   */
  name: string;

  /**
   * Максимальное допустимое отличие в пикселях
   */
  maxDiffPixels?: number;

  /**
   * Максимальное допустимое отличие в процентах (0-1)
   */
  maxDiffPixelRatio?: number;

  /**
   * Порог для определения различия в пикселе (0-1)
   */
  threshold?: number;

  /**
   * Область для скриншота (локатор или селектор)
   */
  clip?: { x: number; y: number; width: number; height: number };

  /**
   * Маска элементов которые нужно скрыть
   */
  mask?: Locator[];

  /**
   * Полный скриншот страницы (с прокруткой)
   */
  fullPage?: boolean;

  /**
   * Анимации (по умолчанию отключены)
   */
  animations?: 'disabled' | 'allow';
}

/**
 * Сделать и сравнить скриншот всей страницы
 */
export async function expectPageSnapshot(
  page: Page,
  options: SnapshotOptions
): Promise<void> {
  const snapshotOptions = {
    fullPage: options.fullPage ?? true,
    animations: options.animations ?? 'disabled' as const,
    mask: options.mask,
    clip: options.clip,
    maxDiffPixels: options.maxDiffPixels,
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.01, // 1% по умолчанию
    threshold: options.threshold ?? 0.2,
  };

  await expect(page).toHaveScreenshot(`${options.name}.png`, snapshotOptions);
}

/**
 * Сделать и сравнить скриншот конкретного элемента
 */
export async function expectElementSnapshot(
  locator: Locator,
  options: SnapshotOptions
): Promise<void> {
  const snapshotOptions = {
    animations: options.animations ?? 'disabled' as const,
    mask: options.mask,
    maxDiffPixels: options.maxDiffPixels,
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.01,
    threshold: options.threshold ?? 0.2,
  };

  await expect(locator).toHaveScreenshot(`${options.name}.png`, snapshotOptions);
}

/**
 * Подготовить страницу для снапшота (скрыть динамический контент)
 */
export async function preparePageForSnapshot(
  page: Page,
  options?: {
    hideDateTimes?: boolean;
    hideAvatars?: boolean;
    hideAnimations?: boolean;
  }
): Promise<void> {
  await page.evaluate((opts) => {
    // Останавливаем анимации
    if (opts?.hideAnimations !== false) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Скрываем даты и время
    if (opts?.hideDateTimes) {
      document.querySelectorAll('[data-testid*="date"], [data-testid*="time"], time').forEach(el => {
        (el as HTMLElement).style.opacity = '0';
      });
    }

    // Скрываем аватары (могут динамически загружаться)
    if (opts?.hideAvatars) {
      document.querySelectorAll('[data-testid*="avatar"], .avatar, img[alt*="avatar"]').forEach(el => {
        (el as HTMLElement).style.opacity = '0';
      });
    }
  }, options);

  // Ждём стабилизации layout
  await page.waitForTimeout(500);
}

/**
 * Сделать скриншот с автоматической маскировкой динамического контента
 */
export async function expectStableSnapshot(
  page: Page,
  options: SnapshotOptions & {
    maskSelectors?: string[];
  }
): Promise<void> {
  // Подготавливаем страницу
  await preparePageForSnapshot(page, {
    hideDateTimes: true,
    hideAnimations: true,
  });

  // Создаём маски для указанных селекторов
  const masks: Locator[] = options.mask || [];
  if (options.maskSelectors) {
    for (const selector of options.maskSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      for (let i = 0; i < count; i++) {
        masks.push(elements.nth(i));
      }
    }
  }

  await expectPageSnapshot(page, {
    ...options,
    mask: masks,
  });
}

/**
 * Сделать скриншот модального окна
 */
export async function expectModalSnapshot(
  page: Page,
  modalLocator: Locator,
  options: SnapshotOptions
): Promise<void> {
  // Ждём что модалка видима
  await expect(modalLocator).toBeVisible();
  await page.waitForTimeout(300); // Анимация открытия

  // Маскируем оверлей за модалкой
  await expectElementSnapshot(modalLocator, {
    ...options,
    animations: 'disabled',
  });
}

/**
 * Сделать скриншоты для разных viewport (desktop, tablet, mobile)
 */
export async function expectResponsiveSnapshots(
  page: Page,
  baseName: string,
  options?: Partial<SnapshotOptions>
): Promise<void> {
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(300); // Ждём адаптацию layout

    await expectPageSnapshot(page, {
      name: `${baseName}-${viewport.name}`,
      ...options,
    } as SnapshotOptions);
  }
}

/**
 * Сделать скриншот списка с фиксированным количеством элементов
 */
export async function expectListSnapshot(
  page: Page,
  listLocator: Locator,
  options: SnapshotOptions & {
    maxItems?: number;
  }
): Promise<void> {
  const items = listLocator.locator('[data-testid*="item"], li, .item');
  const count = await items.count();

  // Если элементов больше максимума, скрываем лишние
  if (options.maxItems && count > options.maxItems) {
    await page.evaluate((max) => {
      const allItems = document.querySelectorAll('[data-testid*="item"], li, .item');
      allItems.forEach((item, index) => {
        if (index >= max) {
          (item as HTMLElement).style.display = 'none';
        }
      });
    }, options.maxItems);
  }

  await expectElementSnapshot(listLocator, options);
}

/**
 * Сделать серию скриншотов для различных состояний компонента
 */
export async function expectStateSnapshots(
  page: Page,
  baseName: string,
  states: Array<{
    name: string;
    setup: () => Promise<void>;
  }>,
  options?: Partial<SnapshotOptions>
): Promise<void> {
  for (const state of states) {
    // Настраиваем состояние
    await state.setup();
    await page.waitForTimeout(300);

    // Делаем скриншот
    await expectPageSnapshot(page, {
      name: `${baseName}-${state.name}`,
      ...options,
    } as SnapshotOptions);
  }
}

/**
 * Обновить все baseline снапшоты (для CI или первого запуска)
 */
export async function updateBaseline(
  page: Page,
  snapshots: Array<{
    name: string;
    action: () => Promise<void>;
  }>
): Promise<void> {
  console.log('📸 Обновление baseline снапшотов...');

  for (const snapshot of snapshots) {
    await snapshot.action();
    console.log(`   ✅ ${snapshot.name}`);
  }

  console.log('✨ Все baseline снапшоты обновлены');
}

/**
 * Сравнить два снапшота и получить метрики различий
 */
export interface DiffMetrics {
  diffPixels: number;
  diffRatio: number;
  passed: boolean;
}

/**
 * Сделать скриншот с hover состоянием
 */
export async function expectHoverSnapshot(
  page: Page,
  elementLocator: Locator,
  options: SnapshotOptions
): Promise<void> {
  // Наводим курсор
  await elementLocator.hover();
  await page.waitForTimeout(200); // Анимация hover

  await expectElementSnapshot(elementLocator, {
    ...options,
    animations: 'disabled',
  });
}

/**
 * Сделать скриншот с focus состоянием
 */
export async function expectFocusSnapshot(
  page: Page,
  elementLocator: Locator,
  options: SnapshotOptions
): Promise<void> {
  // Фокусируемся
  await elementLocator.focus();
  await page.waitForTimeout(100);

  await expectElementSnapshot(elementLocator, {
    ...options,
    animations: 'disabled',
  });
}

/**
 * Скрыть элементы с текстом (для стабильных снапшотов)
 */
export async function maskTextElements(
  page: Page,
  selectors: string[]
): Promise<Locator[]> {
  const masks: Locator[] = [];

  for (const selector of selectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    
    for (let i = 0; i < count; i++) {
      masks.push(elements.nth(i));
    }
  }

  return masks;
}

/**
 * Ожидать загрузку всех изображений перед снапшотом
 */
export async function waitForImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(
      images
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => {
          img.onload = img.onerror = resolve;
        }))
    );
  });
}

/**
 * Общая функция для создания baseline снапшота с best practices
 */
export async function createBaselineSnapshot(
  page: Page,
  options: SnapshotOptions & {
    waitForImages?: boolean;
    stabilize?: boolean;
    maskDynamic?: boolean;
  }
): Promise<void> {
  // Ждём изображения если нужно
  if (options.waitForImages !== false) {
    await waitForImages(page);
  }

  // Стабилизируем страницу
  if (options.stabilize !== false) {
    await preparePageForSnapshot(page, {
      hideDateTimes: options.maskDynamic,
      hideAnimations: true,
    });
  }

  // Делаем снапшот
  await expectPageSnapshot(page, options);
}




