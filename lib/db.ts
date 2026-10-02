import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "tuio-academy.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nif TEXT,
  phone TEXT,
  company TEXT,
  department TEXT,
  job_title TEXT,
  role TEXT NOT NULL DEFAULT 'alumno' CHECK (role IN ('alumno','tutor','admin','superadmin')),
  scope_departments TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  product TEXT NOT NULL DEFAULT 'general',
  hours REAL NOT NULL DEFAULT 1,
  modality TEXT NOT NULL DEFAULT 'Online',
  passing_score INTEGER NOT NULL DEFAULT 70,
  mandatory INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lectura' CHECK (type IN ('lectura','video','documento','test')),
  content TEXT,
  resource_url TEXT,
  duration_min INTEGER NOT NULL DEFAULT 10,
  quiz_json TEXT
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inscrito' CHECK (status IN ('inscrito','en_curso','completado')),
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  enrolled_by INTEGER REFERENCES users(id),
  started_at TEXT,
  last_access_at TEXT,
  completed_at TEXT,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  final_score INTEGER,
  UNIQUE (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS unit_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'visto' CHECK (status IN ('visto','completado')),
  first_viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  time_spent_sec INTEGER NOT NULL DEFAULT 0,
  UNIQUE (enrollment_id, unit_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_units_module ON units(module_id, position);

CREATE TABLE IF NOT EXISTS invitations (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  tutor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_courses (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, course_id)
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminder_log (
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref TEXT,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminder ON reminder_log(enrollment_id, kind);

CREATE TABLE IF NOT EXISTS user_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Columnas añadidas después de la primera versión (las BD existentes se actualizan al arrancar). */
const COLUMNS: [table: string, column: string, ddl: string][] = [
  ["enrollments", "due_at", "TEXT"],
  ["users", "scope_departments", "TEXT"],
  ["invitations", "kind", "TEXT NOT NULL DEFAULT 'activacion'"],
];

function migrate(db: Database.Database) {
  // v3: nuevo rol «superadmin». SQLite no permite cambiar un CHECK: se reconstruye la tabla.
  const ddl = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'users'").get() as { sql: string }).sql;
  if (!ddl.includes("superadmin")) {
    db.pragma("foreign_keys = OFF");
    db.transaction(() => {
      const cols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name).join(", ");
      db.exec(ddl.replace(/CREATE TABLE "?users"?/, "CREATE TABLE users_v3").replace("'tutor','admin')", "'tutor','admin','superadmin')"));
      db.exec(`INSERT INTO users_v3 (${cols}) SELECT ${cols} FROM users; DROP TABLE users; ALTER TABLE users_v3 RENAME TO users;`);
    })();
    db.pragma("foreign_keys = ON");
  }
  for (const [table, column, ddl] of COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __tuioDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) seed(db);
  // Siempre debe existir al menos una cuenta de superadministración.
  if (!db.prepare("SELECT 1 FROM users WHERE role = 'superadmin'").get())
    db.prepare("UPDATE users SET role = 'superadmin' WHERE id = (SELECT MIN(id) FROM users WHERE role = 'admin')").run();
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__tuioDb) globalThis.__tuioDb = open();
  return globalThis.__tuioDb;
}
