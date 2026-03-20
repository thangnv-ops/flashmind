/**
 * Migration Script — run once to set up Supabase tables.
 *
 * Uses the Supabase Management API (HTTPS) — no direct DB connection needed.
 * This is the most reliable method: works behind firewalls, no SSL issues.
 *
 * Usage:
 *   npm run migrate
 *
 * Requirements in .env.local:
 *   VITE_SUPABASE_URL      already set (used to extract project ref)
 *   SUPABASE_ACCESS_TOKEN  get from: https://supabase.com/dashboard/account/tokens
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

if (!ACCESS_TOKEN) {
  console.error('\n❌  Missing SUPABASE_ACCESS_TOKEN in .env.local');
  console.error('   Get a personal access token at:');
  console.error('   https://supabase.com/dashboard/account/tokens\n');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('\n❌  Missing VITE_SUPABASE_URL in .env.local\n');
  process.exit(1);
}

// Extract project ref from URL — https://[ref].supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const sqlPath = resolve(__dirname, '../plan/sql/migration.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Remove comment-only lines, then split on ; to get individual statements
const statements = sql
  .split('\n')
  .filter(line => !line.trimStart().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`\n🔗  Targeting project: ${projectRef}`);
console.log(`📄  Running ${statements.length} statements...\n`);

let executed = 0;
let skipped = 0;

for (const stmt of statements) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: stmt }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg: string = (body as any)?.message ?? (body as any)?.error ?? JSON.stringify(body);

    // Idempotent: skip if object already exists
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate key') ||
      msg.includes('DuplicateTable') ||
      msg.includes('DuplicateObject')
    ) {
      skipped++;
    } else {
      console.error(`❌  Failed on statement:\n${stmt}\n`);
      console.error(`   Error: ${msg}\n`);
      process.exit(1);
    }
  } else {
    executed++;
  }
}

console.log(`✅  Done! ${executed} executed, ${skipped} already existed.`);
console.log('🎉  Your Supabase database is ready!\n');
