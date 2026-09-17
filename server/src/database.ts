import Database from 'better-sqlite3';

export type SqliteDatabase = Database.Database;

export function createDatabase(filename = process.env.DATABASE_PATH ?? 'sharednotes.db'): SqliteDatabase {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      folder_id TEXT REFERENCES folders(id),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON notes(user_id, updated_at);
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      folder_id TEXT REFERENCES folders(id),
      note_id TEXT REFERENCES notes(id),
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      subtasks TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS folders_user_updated_idx ON folders(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS tasks_user_updated_idx ON tasks(user_id, updated_at);
  `);
  const noteColumns = db.prepare('PRAGMA table_info(notes)').all() as Array<{ name: string }>;
  if (!noteColumns.some((column) => column.name === 'folder_id')) db.exec('ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id)');
  const taskColumns = db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
  if (!taskColumns.some((column) => column.name === 'subtasks')) db.exec("ALTER TABLE tasks ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'");
  if (!taskColumns.some((column) => column.name === 'note_id')) db.exec('ALTER TABLE tasks ADD COLUMN note_id TEXT REFERENCES notes(id)');
  return db;
}
