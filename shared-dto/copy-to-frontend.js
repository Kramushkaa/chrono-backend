const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.resolve(BACKEND_ROOT, '..', 'chronoline-frontend');
const DTO_DIST = path.resolve(__dirname, 'dist');
const DTO_SRC = path.resolve(__dirname, 'src');
const FRONTEND_DTO_DIR = path.resolve(FRONTEND_ROOT, 'src', 'shared', 'dto');

// Проверяем, существует ли директория фронтенда
if (!fs.existsSync(FRONTEND_ROOT)) {
  console.log('⚠️  Frontend directory not found, skipping DTO copy');
  console.log(`   Expected at: ${FRONTEND_ROOT}`);
  process.exit(0);
}

// Создаём директорию, если её нет
if (!fs.existsSync(FRONTEND_DTO_DIR)) {
  fs.mkdirSync(FRONTEND_DTO_DIR, { recursive: true });
  console.log(`📁 Created directory: ${FRONTEND_DTO_DIR}`);
}

// Функция для копирования файла с добавлением заголовка
function copyDtoFile(srcFile, destFile, relativePath) {
  if (!fs.existsSync(srcFile)) {
    console.warn(`⚠️  Source file not found: ${srcFile}`);
    return false;
  }

  const content = fs.readFileSync(srcFile, 'utf8');
  const header = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// This file is automatically copied from backend/shared-dto
// Source: ${path.relative(BACKEND_ROOT, srcFile).replace(/\\/g, '/')}
// Generated: ${new Date().toISOString()}

`;
  
  // Для .d.ts файлов обрабатываем содержимое
  // Для .ts файлов (исходных) не обрабатываем - копируем как есть
  let processedContent = content;
  if (srcFile.endsWith('.d.ts')) {
    // Для schemas - оставляем declare, так как это type-only файл
    // TypeScript использует эти типы для z.infer<typeof Schema>
    if (srcFile.includes('schemas')) {
      // Оставляем declare для type-only констант
      // Это позволяет использовать typeof Schema в типах
      // Ничего не меняем - оставляем как есть
    } else {
      // Для остальных файлов убираем declare
      // Убираем declare из export declare const
      processedContent = processedContent.replace(/^export declare const/gm, 'export const');
      // Убираем declare из export declare type/interface
      processedContent = processedContent.replace(/^export declare (type|interface|enum)/gm, 'export $1');
      // Убираем declare из export declare
      processedContent = processedContent.replace(/^export declare /gm, 'export ');
    }
  }
  // Для .ts файлов (исходных) не обрабатываем - они уже содержат правильный код
  
  fs.writeFileSync(destFile, header + processedContent, 'utf8');
  console.log(`✅ Copied ${relativePath}`);
  return true;
}

// Копируем основные файлы
// Для dtoDescriptors используем исходный .ts файл, так как он содержит реальное значение
// Для остальных используем .d.ts файлы (только типы)
const filesToCopy = [
  { src: 'index.d.ts', dest: 'index.ts' },
  { src: 'schemas.d.ts', dest: 'schemas.ts' },
  { src: 'types.d.ts', dest: 'types.ts' },
  { src: 'quiz-types.d.ts', dest: 'quiz-types.ts' },
  { src: 'dtoDescriptors.ts', dest: 'dtoDescriptors.ts', fromSrc: true }, // Используем исходный файл
];

let copiedCount = 0;
filesToCopy.forEach(({ src, dest, fromSrc = false }) => {
  const srcPath = fromSrc 
    ? path.join(DTO_SRC, src)
    : path.join(DTO_DIST, src);
  const destPath = path.join(FRONTEND_DTO_DIR, dest);
  
  if (copyDtoFile(srcPath, destPath, src)) {
    copiedCount++;
  }
});

if (copiedCount > 0) {
  console.log(`✅ Successfully copied ${copiedCount} DTO file(s) to frontend`);
} else {
  console.warn('⚠️  No DTO files were copied. Make sure shared-dto is built first.');
  process.exit(1);
}

