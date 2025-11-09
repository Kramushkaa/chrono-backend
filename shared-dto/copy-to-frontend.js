#!/usr/bin/env node
/**
 * Автоматическое копирование DTO типов во frontend
 * Запускается после сборки shared-dto для синхронизации типов
 */

const fs = require('fs');
const path = require('path');

// Пути
const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '..', 'chronoline-frontend');
const SOURCE_DIR = path.resolve(__dirname, 'dist');
const TARGET_DIR = path.resolve(FRONTEND_ROOT, 'src', 'shared', 'dto');

// Проверка существования frontend проекта
if (!fs.existsSync(FRONTEND_ROOT)) {
  console.warn(`⚠️  Frontend проект не найден: ${FRONTEND_ROOT}`);
  console.warn('   Пропускаем копирование DTO');
  process.exit(0);
}

// Создание целевой директории если не существует
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Файлы для копирования
const FILES_TO_COPY = [
  'index.d.ts',
  'types.d.ts',
  'quiz-types.d.ts',
  'dtoDescriptors.d.ts'
];

console.log('📦 Копирование DTO типов во frontend...');

let copiedFiles = 0;
FILES_TO_COPY.forEach(file => {
  const sourcePath = path.join(SOURCE_DIR, file);
  const targetPath = path.join(TARGET_DIR, file.replace('.d.ts', '.ts'));
  
  if (fs.existsSync(sourcePath)) {
    let content = fs.readFileSync(sourcePath, 'utf8');
    
    // Для index.ts убираем экспорт schemas (зависит от zod, не нужен во фронтенде)
    if (file === 'index.d.ts') {
      content = content.replace(/export \* from ['"]\.\/schemas['"];?\s*\n?/g, '');
    }
    
    // Для types.ts убираем импорты zod и schemas, и заменяем z.infer на any (типы уже определены в dtoDescriptors)
    if (file === 'types.d.ts') {
      content = content.replace(/import type \{ z \} from ['"]zod['"];?\s*\n?/g, '');
      content = content.replace(/import type \{[^}]+\} from ['"]\.\/schemas['"];?\s*\n?/g, '');
      content = content.replace(/z\.infer<typeof \w+>/g, 'any');
    }
    
    // Убираем 'declare' из констант, чтобы Rollup мог их правильно реэкспортировать
    // Для DTO_VERSION делаем обычный const, для остальных (типов) — делаем type
    content = content.replace(/export declare const (DTO_VERSION[^;]+;)/g, 'export const $1');
    content = content.replace(/export declare const (\w+):/g, 'export type $1 =');
    
    // Добавляем комментарий о том, что файл автоматически сгенерирован
    const header = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// This file is automatically copied from backend/shared-dto
// Source: ${sourcePath}
// Generated: ${new Date().toISOString()}

`;
    content = header + content;
    
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`   ✓ ${file} → ${path.relative(FRONTEND_ROOT, targetPath)}`);
    copiedFiles++;
  } else {
    console.warn(`   ⚠️  Файл не найден: ${file}`);
  }
});

console.log(`\n✨ Скопировано ${copiedFiles} файлов`);
console.log(`   Frontend DTO: ${path.relative(process.cwd(), TARGET_DIR)}`);

