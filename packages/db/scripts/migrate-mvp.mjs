/**
 * Apply MVP schema deltas that drizzle-kit push struggles with on existing SQLite DBs.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dbPath = process.env.TASKYARD_DB_PATH
  ? path.resolve(root, process.env.TASKYARD_DB_PATH)
  : path.join(root, 'data', 'taskyard.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function columns(table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

function hasTable(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

const projectCols = columns('projects');
if (!projectCols.has('archived')) {
  db.exec(`ALTER TABLE projects ADD COLUMN archived integer DEFAULT 0`);
  console.log('added projects.archived');
}
if (!projectCols.has('archived_at')) {
  db.exec(`ALTER TABLE projects ADD COLUMN archived_at integer`);
  console.log('added projects.archived_at');
}

if (!hasTable('tasks')) {
  db.exec(`
    CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL REFERENCES projects(id),
      parent_id text,
      title text NOT NULL,
      description text DEFAULT '' NOT NULL,
      status text DEFAULT 'backlog' NOT NULL,
      assignee text,
      created_at integer,
      updated_at integer
    );
  `);
  console.log('created tasks');
}

if (!hasTable('task_activity')) {
  db.exec(`
    CREATE TABLE task_activity (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      task_id text NOT NULL REFERENCES tasks(id),
      kind text NOT NULL,
      actor text NOT NULL,
      payload text NOT NULL,
      timestamp integer
    );
  `);
  console.log('created task_activity');
}

const threadCols = columns('threads');
if (!threadCols.has('task_id')) {
  db.exec(`ALTER TABLE threads ADD COLUMN task_id text REFERENCES tasks(id)`);
  console.log('added threads.task_id');
}

if (!hasTable('task_dependencies')) {
  db.exec(`
    CREATE TABLE task_dependencies (
      task_id text NOT NULL REFERENCES tasks(id),
      depends_on_task_id text NOT NULL REFERENCES tasks(id),
      PRIMARY KEY (task_id, depends_on_task_id)
    );
  `);
  console.log('created task_dependencies');
}

if (!hasTable('task_decisions')) {
  db.exec(`
    CREATE TABLE task_decisions (
      id text PRIMARY KEY NOT NULL,
      short_id text NOT NULL,
      task_id text NOT NULL REFERENCES tasks(id),
      project_id text NOT NULL REFERENCES projects(id),
      choice text NOT NULL,
      why text NOT NULL,
      status text DEFAULT 'accepted' NOT NULL,
      exported_at integer,
      created_at integer
    );
    CREATE UNIQUE INDEX IF NOT EXISTS task_decisions_project_short
      ON task_decisions(project_id, short_id);
  `);
  console.log('created task_decisions');
}

const projectColsAfter = columns('projects');
if (!projectColsAfter.has('task_prefix')) {
  db.exec(`ALTER TABLE projects ADD COLUMN task_prefix text`);
  console.log('added projects.task_prefix');
}
if (!projectColsAfter.has('next_task_number')) {
  db.exec(`ALTER TABLE projects ADD COLUMN next_task_number integer NOT NULL DEFAULT 0`);
  console.log('added projects.next_task_number');
}
if (!projectColsAfter.has('next_decision_number')) {
  db.exec(`ALTER TABLE projects ADD COLUMN next_decision_number integer NOT NULL DEFAULT 0`);
  console.log('added projects.next_decision_number');
}
if (!projectColsAfter.has('sort_order')) {
  db.exec(`ALTER TABLE projects ADD COLUMN sort_order integer NOT NULL DEFAULT 0`);
  const ordered = db.prepare('SELECT id FROM projects ORDER BY created_at, rowid').all();
  const setOrder = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?');
  ordered.forEach((row, index) => setOrder.run(index, row.id));
  console.log('added projects.sort_order');
}

const taskCols = columns('tasks');
if (hasTable('tasks') && !taskCols.has('short_id')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN short_id text`);
  console.log('added tasks.short_id');
}
if (hasTable('tasks') && !taskCols.has('task_type')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN task_type text NOT NULL DEFAULT 'feature'`);
  console.log('added tasks.task_type');
}
{
  const cols = columns('tasks');
  if (hasTable('tasks') && !cols.has('priority')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN priority text NOT NULL DEFAULT 'medium'`);
    console.log('added tasks.priority');
  }
}
{
  const cols = columns('tasks');
  if (hasTable('tasks') && !cols.has('category')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN category text`);
    console.log('added tasks.category');
  }
}

function prefixFromName(name) {
  const words = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  let prefix;
  if (words.length >= 2) prefix = `${words[0][0]}${words[1][0]}`;
  else if (words[0]) prefix = (words[0].replace(/[^A-Za-z]/g, '').slice(0, 2) || 'T');
  else prefix = 'T';
  prefix = prefix.toUpperCase();
  if (prefix.length < 2) prefix = `${prefix}X`.slice(0, 2);
  return prefix;
}

if (hasTable('tasks') && hasTable('projects')) {
  const projectRows = db.prepare('SELECT id, name, task_prefix FROM projects').all();
  const used = new Set(projectRows.map((row) => row.task_prefix).filter(Boolean));
  for (const project of projectRows) {
    if (project.task_prefix) continue;
    let prefix = prefixFromName(project.name);
    if (used.has(prefix)) {
      let n = 2;
      while (used.has(`${prefix}${n}`)) n += 1;
      prefix = `${prefix}${n}`;
    }
    used.add(prefix);
    db.prepare('UPDATE projects SET task_prefix = ? WHERE id = ?').run(prefix, project.id);
  }

  const ready = db.prepare('SELECT id, task_prefix FROM projects').all();
  for (const project of ready) {
    const taskRows = db
      .prepare('SELECT id, short_id FROM tasks WHERE project_id = ? ORDER BY created_at, id')
      .all(project.id);
    let max = 0;
    for (const task of taskRows) {
      const match = typeof task.short_id === 'string'
        ? new RegExp(`^${project.task_prefix}-(\\d+)$`).exec(task.short_id)
        : null;
      if (match) max = Math.max(max, Number(match[1]));
    }
    for (const task of taskRows) {
      if (task.short_id) continue;
      max += 1;
      db.prepare('UPDATE tasks SET short_id = ? WHERE id = ?').run(`${project.task_prefix}-${max}`, task.id);
    }
    db.prepare('UPDATE projects SET next_task_number = ? WHERE id = ? AND next_task_number < ?').run(
      max,
      project.id,
      max,
    );
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS tasks_short_id_unique ON tasks(short_id)`);
}

if (!hasTable('people')) {
  db.exec(`
    CREATE TABLE people (
      id text PRIMARY KEY NOT NULL,
      username text NOT NULL,
      display_name text NOT NULL,
      password_hash text NOT NULL,
      must_change_password integer DEFAULT 0 NOT NULL,
      created_at integer
    );
    CREATE UNIQUE INDEX people_username_unique ON people(username);
  `);
  console.log('created people');
}

if (!hasTable('sessions')) {
  db.exec(`
    CREATE TABLE sessions (
      id text PRIMARY KEY NOT NULL,
      person_id text NOT NULL REFERENCES people(id),
      token_hash text NOT NULL,
      kind text DEFAULT 'web' NOT NULL,
      must_change_password integer DEFAULT 0 NOT NULL,
      created_at integer
    );
    CREATE UNIQUE INDEX sessions_token_hash_unique ON sessions(token_hash);
  `);
  console.log('created sessions');
}

if (!hasTable('collections')) {
  db.exec(`
    CREATE TABLE collections (
      id text PRIMARY KEY NOT NULL,
      person_id text NOT NULL REFERENCES people(id),
      name text NOT NULL,
      created_at integer
    );
    CREATE UNIQUE INDEX collections_person_name ON collections(person_id, name);
  `);
  console.log('created collections');
}

if (!hasTable('collection_projects')) {
  db.exec(`
    CREATE TABLE collection_projects (
      collection_id text NOT NULL REFERENCES collections(id),
      project_id text NOT NULL REFERENCES projects(id),
      sort_order integer DEFAULT 0 NOT NULL,
      PRIMARY KEY (collection_id, project_id)
    );
  `);
  console.log('created collection_projects');
}

if (!hasTable('ideas')) {
  db.exec(`
    CREATE TABLE ideas (
      id text PRIMARY KEY NOT NULL,
      short_id text NOT NULL,
      owner_id text NOT NULL REFERENCES people(id),
      title text NOT NULL,
      description text DEFAULT '' NOT NULL,
      archived_at integer,
      promoted_project_id text REFERENCES projects(id),
      created_at integer,
      updated_at integer
    );
    CREATE UNIQUE INDEX ideas_short_id_unique ON ideas(short_id);
    CREATE UNIQUE INDEX ideas_promoted_project_unique ON ideas(promoted_project_id);
  `);
  console.log('created ideas');
}

if (!hasTable('idea_activity')) {
  db.exec(`
    CREATE TABLE idea_activity (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      idea_id text NOT NULL REFERENCES ideas(id),
      kind text NOT NULL,
      actor text NOT NULL,
      payload text NOT NULL,
      timestamp integer
    );
  `);
  console.log('created idea_activity');
}

if (!hasTable('collection_ideas')) {
  db.exec(`
    CREATE TABLE collection_ideas (
      collection_id text NOT NULL REFERENCES collections(id),
      idea_id text NOT NULL REFERENCES ideas(id),
      sort_order integer DEFAULT 0 NOT NULL,
      PRIMARY KEY (collection_id, idea_id)
    );
  `);
  console.log('created collection_ideas');
}

if (!hasTable('project_guests')) {
  db.exec(`
    CREATE TABLE project_guests (
      project_id text NOT NULL REFERENCES projects(id),
      person_id text NOT NULL REFERENCES people(id),
      PRIMARY KEY (project_id, person_id)
    );
  `);
  console.log('created project_guests');
}

const ideaThreadCols = columns('threads');
if (!ideaThreadCols.has('idea_id')) {
  db.exec(`ALTER TABLE threads ADD COLUMN idea_id text REFERENCES ideas(id)`);
  console.log('added threads.idea_id');
}

// D-014 — triggers own search-index maintenance, keeping write callers unaware of it.
function taskDocumentSelect(where) {
  return `
    SELECT
      tasks.short_id,
      tasks.title,
      tasks.description,
      COALESCE((
        SELECT group_concat(json_extract(activity.payload, '$.text'), ' ')
        FROM task_activity AS activity
        WHERE activity.task_id = tasks.id AND activity.kind = 'comment'
      ), ''),
      COALESCE((
        SELECT group_concat(decision.choice || ' ' || decision.why, ' ')
        FROM task_decisions AS decision
        WHERE decision.task_id = tasks.id
      ), ''),
      tasks.id
    FROM tasks
    WHERE ${where}
  `;
}

function ideaDocumentSelect(where) {
  return `
    SELECT
      ideas.short_id,
      ideas.title,
      ideas.description,
      COALESCE((
        SELECT group_concat(json_extract(activity.payload, '$.text'), ' ')
        FROM idea_activity AS activity
        WHERE activity.idea_id = ideas.id AND activity.kind = 'comment'
      ), ''),
      ideas.id
    FROM ideas
    WHERE ${where}
  `;
}

function refreshTaskSearch(id) {
  return `
    DELETE FROM task_search WHERE task_id = ${id};
    INSERT INTO task_search (short_id, title, brief, comments, decisions, task_id)
    ${taskDocumentSelect(`tasks.id = ${id}`)};
  `;
}

function refreshIdeaSearch(id) {
  return `
    DELETE FROM idea_search WHERE idea_id = ${id};
    INSERT INTO idea_search (short_id, title, brief, comments, idea_id)
    ${ideaDocumentSelect(`ideas.id = ${id}`)};
  `;
}

const taskSearchExisted = hasTable('task_search');
const ideaSearchExisted = hasTable('idea_search');
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS task_search USING fts5(
    short_id,
    title,
    brief,
    comments,
    decisions,
    task_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS idea_search USING fts5(
    short_id,
    title,
    brief,
    comments,
    idea_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  );
`);
if (!taskSearchExisted) {
  db.exec(`
    INSERT INTO task_search (short_id, title, brief, comments, decisions, task_id)
    ${taskDocumentSelect('1 = 1')};
  `);
}
if (!ideaSearchExisted) {
  db.exec(`
    INSERT INTO idea_search (short_id, title, brief, comments, idea_id)
    ${ideaDocumentSelect('1 = 1')};
  `);
}

db.exec(`
  CREATE TRIGGER IF NOT EXISTS task_search_task_insert AFTER INSERT ON tasks BEGIN
    ${refreshTaskSearch('new.id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_task_update
  AFTER UPDATE OF short_id, title, description ON tasks BEGIN
    ${refreshTaskSearch('new.id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_task_delete AFTER DELETE ON tasks BEGIN
    DELETE FROM task_search WHERE task_id = old.id;
  END;

  CREATE TRIGGER IF NOT EXISTS task_search_activity_insert AFTER INSERT ON task_activity BEGIN
    ${refreshTaskSearch('new.task_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_activity_update
  AFTER UPDATE OF task_id, kind, payload ON task_activity BEGIN
    ${refreshTaskSearch('old.task_id')}
    ${refreshTaskSearch('new.task_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_activity_delete AFTER DELETE ON task_activity BEGIN
    ${refreshTaskSearch('old.task_id')}
  END;

  CREATE TRIGGER IF NOT EXISTS task_search_decision_insert AFTER INSERT ON task_decisions BEGIN
    ${refreshTaskSearch('new.task_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_decision_update
  AFTER UPDATE OF task_id, choice, why ON task_decisions BEGIN
    ${refreshTaskSearch('old.task_id')}
    ${refreshTaskSearch('new.task_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS task_search_decision_delete AFTER DELETE ON task_decisions BEGIN
    ${refreshTaskSearch('old.task_id')}
  END;

  CREATE TRIGGER IF NOT EXISTS idea_search_idea_insert AFTER INSERT ON ideas BEGIN
    ${refreshIdeaSearch('new.id')}
  END;
  CREATE TRIGGER IF NOT EXISTS idea_search_idea_update
  AFTER UPDATE OF short_id, title, description ON ideas BEGIN
    ${refreshIdeaSearch('new.id')}
  END;
  CREATE TRIGGER IF NOT EXISTS idea_search_idea_delete AFTER DELETE ON ideas BEGIN
    DELETE FROM idea_search WHERE idea_id = old.id;
  END;

  CREATE TRIGGER IF NOT EXISTS idea_search_activity_insert AFTER INSERT ON idea_activity BEGIN
    ${refreshIdeaSearch('new.idea_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS idea_search_activity_update
  AFTER UPDATE OF idea_id, kind, payload ON idea_activity BEGIN
    ${refreshIdeaSearch('old.idea_id')}
    ${refreshIdeaSearch('new.idea_id')}
  END;
  CREATE TRIGGER IF NOT EXISTS idea_search_activity_delete AFTER DELETE ON idea_activity BEGIN
    ${refreshIdeaSearch('old.idea_id')}
  END;
`);

console.log('migrate-mvp OK:', dbPath);
db.close();
