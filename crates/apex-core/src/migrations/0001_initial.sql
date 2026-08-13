CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_opened_at INTEGER
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    cwd TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
);

CREATE INDEX sessions_by_project ON sessions (project_id, closed_at);
