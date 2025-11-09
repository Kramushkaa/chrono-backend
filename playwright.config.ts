import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация Playwright для E2E тестов Хронониндзя
 * 
 * Использует тестовую схему БД (DB_SCHEMA=test) для изоляции данных
 */
export default defineConfig({
  testDir: './e2e/tests',
  
  // Таймауты
  timeout: 30 * 1000, // 30 секунд на тест
  expect: {
    timeout: 5000, // 5 секунд на assertion
  },

  // Запускаем тесты последовательно (можно переключить на параллельный режим)
  fullyParallel: false,
  
  // Количество неудачных попыток перед фейлом (retry для стабильности)
  retries: process.env.CI ? 2 : 1,
  
  // Количество воркеров (параллельное выполнение)
  workers: process.env.CI ? 4 : 2,
  
  // Репортеры
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
    ['json', { outputFile: 'e2e-results.json' }],
  ],

  // Общие настройки для всех проектов
  use: {
    // Базовый URL фронтенда
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // API URL бэкенда
    // @ts-ignore - используется в тестах через testInfo
    apiURL: process.env.BACKEND_URL || 'http://localhost:3001',
    
    // Trace при падении теста
    trace: 'on-first-retry',
    
    // Скриншот при падении
    screenshot: 'only-on-failure',
    
    // Видео только при падении
    video: 'retain-on-failure',
    
    // Таймаут для действий (клики, заполнение форм)
    actionTimeout: 10000,
    
    // Таймаут для навигации
    navigationTimeout: 30000,
  },

  // Определение проектов (браузеры и типы тестов)
  projects: [
    // Smoke тесты - быстрые критичные проверки
    {
      name: 'smoke-chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@smoke/,
      grepInvert: /@slow/,
    },

    // Full regression - все браузеры
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grep: /@regression|@smoke/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: /@regression/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      grep: /@regression/,
    },

    // Мобильные устройства
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /@regression/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      grep: /@regression/,
    },

    // Accessibility тесты
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      grep: /@accessibility/,
    },

    // Visual regression тесты
    {
      name: 'visual',
      use: { ...devices['Desktop Chrome'] },
      grep: /@visual/,
    },
  ],

  // Global setup - выполняется перед всеми тестами
  globalSetup: require.resolve('./e2e/global-setup.ts'),

  // Web server для локального запуска (опционально)
  // Раскомментировать если нужно автоматически запускать фронтенд/бэкенд
  // webServer: [
  //   {
  //     command: 'npm run dev:test',
  //     port: 3001,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'cd ../chronoline-frontend && npm run dev',
  //     port: 3000,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});

