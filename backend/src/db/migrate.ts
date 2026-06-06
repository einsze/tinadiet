import { db } from './sqlite.js';
import { migrations } from './migrations.js';

const META_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name        TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

export const runMigrations = (): { applied: string[]; skipped: string[] } => {
  db.exec(META_TABLE_SQL);

  const appliedRows = db
    .prepare('SELECT name FROM _migrations')
    .all() as Array<{ name: string }>;
  const alreadyApplied = new Set(appliedRows.map((r) => r.name));

  const recordMigration = db.prepare(
    'INSERT INTO _migrations (name) VALUES (?)'
  );

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const m of migrations) {
    if (alreadyApplied.has(m.name)) {
      skipped.push(m.name);
      continue;
    }
    const tx = db.transaction(() => {
      db.exec(m.sql);
      recordMigration.run(m.name);
    });
    tx();
    applied.push(m.name);
    console.log(
      JSON.stringify({ level: 'info', msg: 'migration.applied', name: m.name })
    );
  }

  return { applied, skipped };
};
