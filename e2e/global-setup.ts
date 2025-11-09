import { chromium, FullConfig } from '@playwright/test';
import { resetDatabase, seedTestData } from './utils/db-reset';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global setup для E2E тестов
 * Выполняется один раз перед всеми тестами
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Запуск global setup для E2E тестов...');

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // 0. Проверка синхронизации DTO версий
  console.log('🔍 Проверка синхронизации DTO...');
  try {
    const checkDtoSyncPath = path.join(__dirname, '../../check-dto-sync.js');
    
    if (fs.existsSync(checkDtoSyncPath)) {
      const { execSync } = require('child_process');
      execSync(`node "${checkDtoSyncPath}"`, { stdio: 'inherit' });
      console.log('✅ DTO версии синхронизированы');
    } else {
      console.warn('⚠️  check-dto-sync.js не найден, пропускаем проверку');
    }
  } catch (error: any) {
    console.error('❌ DTO версии не синхронизированы!');
    console.error('   Пожалуйста, пересоберите shared-dto и скопируйте его во frontend');
    throw new Error('DTO synchronization check failed');
  }

  // 1. Проверка доступности бэкенда
  console.log('📡 Проверка доступности бэкенда...');
  try {
    const response = await fetch(`${backendUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Backend недоступен: ${response.status}`);
    }
    console.log('✅ Backend доступен');
  } catch (error) {
    console.error('❌ Backend недоступен:', error);
    throw new Error(
      `Backend не отвечает на ${backendUrl}/api/health. Убедитесь что сервер запущен с DB_SCHEMA=test`
    );
  }

  // 2. Проверка доступности фронтенда
  console.log('📡 Проверка доступности фронтенда...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✅ Frontend доступен');
  } catch (error) {
    console.error('❌ Frontend недоступен:', error);
    await browser.close();
    throw new Error(
      `Frontend не отвечает на ${frontendUrl}. Убедитесь что dev server запущен`
    );
  }
  await browser.close();

  // 3. Сброс и инициализация тестовой БД
  console.log('🗄️  Сброс тестовой базы данных...');
  try {
    await resetDatabase();
    console.log('✅ База данных сброшена');
  } catch (error) {
    console.error('❌ Ошибка при сбросе БД:', error);
    throw error;
  }

  // 4. Загрузка seed данных
  console.log('🌱 Загрузка seed данных...');
  try {
    await seedTestData();
    console.log('✅ Seed данные загружены');
  } catch (error) {
    console.error('❌ Ошибка при загрузке seed данных:', error);
    throw error;
  }

  console.log('✨ Global setup завершён успешно!');
}

export default globalSetup;

