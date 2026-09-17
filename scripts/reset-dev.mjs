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
      db.prepare('DELETE FROM memory_claims').run();
      db.prepare('DELETE FROM memory_events').run();
      db.prepare('DELETE FROM self_directives').run();
      db.prepare('DELETE FROM self_relationships').run();
      db.prepare('DELETE FROM self_identity').run();
      db.close();
      console.log(`✓ Reset ${rel} to blank slate`);
      clearedAny = true;
    } catch (e) {
      console.warn(`! Could not reset ${rel}: ${e.message}`);
    }
  }
}

if (!clearedAny) {
  console.log('No existing databases found to reset. Ready for clean testing.');
}
