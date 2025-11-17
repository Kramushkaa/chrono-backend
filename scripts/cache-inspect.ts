/// <reference lib="dom" />
import dotenv from 'dotenv';

dotenv.config({ override: false });

const DEFAULT_BASE = `http://localhost:${process.env.PORT || 3001}`;
const targetUrl =
  process.env.CACHE_INSPECT_URL ||
  process.env.CACHE_INSPECT_ENDPOINT ||
  `${DEFAULT_BASE}/api/cache/stats`;

async function main() {
  try {
    const res = await fetch(targetUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}`);
    }

    const payload = (await res.json()) as {
      success?: boolean;
      data?: {
        size: number;
        keys: string[];
        entries: Array<{
          key: string;
          expiresInMs: number;
          metadata?: Record<string, unknown>;
        }>;
      };
    };

    const stats = payload?.data;
    if (!stats) {
      console.warn('⚠️  Cache stats payload is empty.');
      return;
    }

    console.log(`🧠 Cache stats from ${targetUrl}`);
    if (stats.entries.length === 0) {
      console.log('Cache is empty.');
    } else {
      console.table(
        stats.entries.map(entry => ({
          key: entry.key,
          expiresInMs: entry.expiresInMs,
          etag: entry.metadata?.etag ?? '—',
          ttl: entry.metadata?.ttlMs ? `${entry.metadata.ttlMs}ms` : '—',
        }))
      );
    }

    console.log(`Total entries: ${stats.size}`);
    console.log('Keys:', stats.keys.join(', ') || 'none');
  } catch (error) {
    console.error('❌ Failed to inspect cache endpoint.');
    console.error('   Ensure the backend server is running and accessible.');
    console.error(`   URL: ${targetUrl}`);
    console.error(`   Details: ${(error as Error).message}`);
    process.exit(1);
  }
}

void main();

