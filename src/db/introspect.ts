import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

type TableInfo = {
  table: string;
  columns: Array<{ name: string; type: string; nullable: boolean; default: string | null }>;
  primaryKey: string[];
  foreignKeys: Array<{ constraint: string; column: string; refTable: string; refColumn: string; onDelete?: string; onUpdate?: string }>;
  indexes: Array<{ name: string; definition: string }>; 
};

type ViewInfo = {
  view: string;
  definition: string;
};

async function introspect(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'chrononinja',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined as any,
  });

  const client = await pool.connect();
  try {
    // tables
    const tablesRes = await client.query<{
      table_name: string;
    }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const tableNames = tablesRes.rows.map(r => r.table_name);

    const tables: TableInfo[] = [];

    for (const table of tableNames) {
      const colsRes = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: 'YES' | 'NO';
        column_default: string | null;
      }>(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      const pkRes = await client.query<{
        column_name: string;
      }>(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`,
        [table]
      );

      const fkRes = await client.query<{
        constraint_name: string;
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
        delete_rule: string | null;
        update_rule: string | null;
      }>(
        `SELECT
           tc.constraint_name,
           kcu.column_name,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name,
           rc.delete_rule,
           rc.update_rule
         FROM information_schema.table_constraints AS tc
         JOIN information_schema.key_column_usage AS kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage AS ccu
           ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
         JOIN information_schema.referential_constraints AS rc
           ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
         WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
         ORDER BY tc.constraint_name, kcu.ordinal_position`,
        [table]
      );

      const idxRes = await client.query<{
        indexname: string;
        indexdef: string;
      }>(
        `SELECT indexname, indexdef
         FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1
         ORDER BY indexname`,
        [table]
      );

      const tableInfo: TableInfo = {
        table,
        columns: colsRes.rows.map(r => ({ name: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES', default: r.column_default })),
        primaryKey: pkRes.rows.map(r => r.column_name),
        foreignKeys: fkRes.rows.map(r => ({
          constraint: r.constraint_name,
          column: r.column_name,
          refTable: r.foreign_table_name,
          refColumn: r.foreign_column_name,
          onDelete: r.delete_rule || undefined,
          onUpdate: r.update_rule || undefined,
        })),
        indexes: idxRes.rows.map(r => ({ name: r.indexname, definition: r.indexdef })),
      };
      tables.push(tableInfo);
    }

    // views
    const viewsRes = await client.query<{
      table_name: string;
      view_definition: string | null;
    }>(
      `SELECT table_name, view_definition
       FROM information_schema.views
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );
    const views: ViewInfo[] = viewsRes.rows.map(v => ({ view: v.table_name, definition: v.view_definition || '' }));

    // Render markdown
    const lines: string[] = [];
    lines.push('# Структура базы данных — Хронониндзя');
    lines.push('');
    lines.push('Автоматически сгенерировано из текущей базы (schema public). Параметры подключения берутся из переменных окружения `DB_*`.');
    lines.push('');
    lines.push('## Таблицы');
    lines.push('');
    for (const t of tables) {
      lines.push(`### ${t.table}`);
      lines.push('');
      // columns table
      lines.push('| Колонка | Тип | NULL | По умолчанию |');
      lines.push('|---|---|:--:|---|');
      for (const c of t.columns) {
        const def = c.default ? c.default.replace(/\n/g, ' ') : '';
        lines.push(`| ${c.name} | ${c.type} | ${c.nullable ? 'YES' : 'NO'} | ${def} |`);
      }
      lines.push('');
      if (t.primaryKey.length > 0) {
        lines.push(`- **Первичный ключ**: ${t.primaryKey.join(', ')}`);
      }
      if (t.foreignKeys.length > 0) {
        lines.push('- **Внешние ключи**:');
        for (const fk of t.foreignKeys) {
          const act = [fk.onDelete ? `ON DELETE ${fk.onDelete}` : '', fk.onUpdate ? `ON UPDATE ${fk.onUpdate}` : ''].filter(Boolean).join(' ');
          lines.push(`  - ${fk.constraint}: (${fk.column}) → ${fk.refTable}(${fk.refColumn}) ${act}`.trim());
        }
      }
      if (t.indexes.length > 0) {
        lines.push('- **Индексы**:');
        for (const idx of t.indexes) {
          lines.push(`  - ${idx.name}: ${idx.definition}`);
        }
      }
      lines.push('');
    }

    lines.push('');
    lines.push('## Представления (Views)');
    lines.push('');
    for (const v of views) {
      lines.push(`### ${v.view}`);
      const def = v.definition?.trim() || '';
      if (def) {
        // Keep it readable: wrap in code fence
        lines.push('```sql');
        lines.push(def);
        lines.push('```');
      } else {
        lines.push('_Определение недоступно через information_schema_');
      }
      lines.push('');
    }

    const outPath = path.resolve(__dirname, '../../DB_SCHEMA.md');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`✅ Схема сохранена в ${outPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

introspect().catch((e) => {
  console.error('❌ Introspection failed:', e);
  process.exit(1);
});


