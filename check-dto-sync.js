#!/usr/bin/env node

/**
 * Прокси-скрипт для запусков из директории backend.
 * Делегирует выполнение корневому check-dto-sync.js.
 */

const path = require('path');

require(path.resolve(__dirname, '..', 'check-dto-sync.js'));

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
