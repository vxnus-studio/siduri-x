#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const targetPaths = [
  process.env.STORAGE_PATH,
  process.env.SQLITE_DB_PATH,
  process.argv[2],
  'siduri.sqlite',
  'apps/api/siduri.sqlite',
  '../test/siduri/siduri.sqlite',
].filter(Boolean);

let clearedAny = false;
const visited = new Set();

for (const rel of targetPaths) {
  const fullPath = path.resolve(process.cwd(), rel);
  if (visited.has(fullPath)) continue;
  visited.add(fullPath);

  if (fs.existsSync(fullPath)) {
    try {
      const db = new DatabaseSync(fullPath);
      const tables = [
        // Archive
        'archive_events',
        // Memory (Legacy)
        'memory_claims',
        'memory_events',
        // Self
        'self_directives',
        'self_relationships',
        'self_identity',
        'self_personality',
        'self_exemplars',
        // Life Database
        'life_entities',
        'life_events',
        'life_finance',
        'life_inventory',
        'life_preferences',
        'life_schedule',
        'life_tasks',
        // System
        'system_logs',
      ];
      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch {}
      }
      try { db.exec('VACUUM'); } catch {}
      db.close();
      console.log(`✓ Reset ${rel} (Memory, Self, LifeDB, Logs) to blank slate`);
      clearedAny = true;
    } catch (e) {
      console.warn(`! Could not reset ${rel}: ${e.message}`);
    }
  }
}

if (!clearedAny) {
  console.log('No existing databases found to reset. Ready for clean testing.');
}
