use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use apex_proto::SessionState;
use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

const MIGRATIONS: &[&str] = &[
    include_str!("migrations/0001_initial.sql"),
    include_str!("migrations/0002_projects.sql"),
    include_str!("migrations/0003_worktrees.sql"),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub root: String,
    pub is_git: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    pub id: Uuid,
    pub project_id: Uuid,
    pub agent: String,
    pub title: String,
    pub cwd: String,
    pub state: SessionState,
    pub worktree: Option<(String, String)>,
    pub created_at: i64,
}

pub struct Store {
    connection: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creating {}", parent.display()))?;
        }
        let connection =
            Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        Self::from_connection(connection)
    }

    pub fn in_memory() -> Result<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(connection: Connection) -> Result<Self> {
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        let mut store = Self { connection };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&mut self) -> Result<()> {
        let applied: usize = self.connection.pragma_query_value(None, "user_version", |row| {
            row.get::<_, i64>(0).map(|value| value as usize)
        })?;

        for (index, migration) in MIGRATIONS.iter().enumerate().skip(applied) {
            self.connection
                .execute_batch(migration)
                .with_context(|| format!("applying migration {}", index + 1))?;
            self.connection.pragma_update(None, "user_version", (index + 1) as i64)?;
        }
        Ok(())
    }

    pub fn schema_version(&self) -> Result<usize> {
        Ok(self.connection.pragma_query_value(None, "user_version", |row| {
            row.get::<_, i64>(0).map(|value| value as usize)
        })?)
    }

    pub fn open_project(&self, root: &Path) -> Result<Project> {
        let root_text = root.display().to_string();
        let name = root
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| root_text.clone());
        let is_git = root.join(".git").exists();

        if let Some(existing) = self.project_by_root(&root_text)? {
            self.connection.execute(
                "UPDATE projects SET last_opened_at = unixepoch('subsec'), is_git = ?2 WHERE id = ?1",
                params![existing.id.to_string(), is_git],
            )?;
            return Ok(Project { is_git, ..existing });
        }

        let id = Uuid::new_v4();
        self.connection.execute(
            "INSERT INTO projects (id, name, root, is_git, created_at, last_opened_at)
             VALUES (?1, ?2, ?3, ?4, unixepoch('subsec'), unixepoch('subsec'))",
            params![id.to_string(), name, root_text, is_git],
        )?;
        Ok(Project { id, name, root: root_text, is_git })
    }

    pub fn project_by_root(&self, root: &str) -> Result<Option<Project>> {
        Ok(self
            .connection
            .query_row(
                "SELECT id, name, root, is_git FROM projects WHERE root = ?1",
                params![root],
                map_project,
            )
            .optional()?)
    }

    pub fn project(&self, id: Uuid) -> Result<Option<Project>> {
        Ok(self
            .connection
            .query_row(
                "SELECT id, name, root, is_git FROM projects WHERE id = ?1",
                params![id.to_string()],
                map_project,
            )
            .optional()?)
    }

    pub fn delete_project(&self, id: Uuid) -> Result<()> {
        self.connection
            .execute("DELETE FROM projects WHERE id = ?1", params![id.to_string()])?;
        Ok(())
    }

    pub fn list_projects(&self) -> Result<Vec<Project>> {
        let mut statement = self.connection.prepare(
            "SELECT id, name, root, is_git FROM projects
             ORDER BY COALESCE(last_opened_at, created_at) DESC",
        )?;
        let rows = statement.query_map([], map_project)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn save_layout(&self, project_id: Uuid, payload: &str) -> Result<()> {
        self.connection.execute(
            "INSERT INTO layouts (project_id, payload, updated_at)
             VALUES (?1, ?2, unixepoch())
             ON CONFLICT(project_id) DO UPDATE SET payload = ?2, updated_at = unixepoch()",
            params![project_id.to_string(), payload],
        )?;
        Ok(())
    }

    pub fn load_layout(&self, project_id: Uuid) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row(
                "SELECT payload FROM layouts WHERE project_id = ?1",
                params![project_id.to_string()],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn insert_session(
        &self,
        project_id: Uuid,
        agent: &str,
        title: &str,
        cwd: &str,
        worktree: Option<(&str, &str)>,
    ) -> Result<Session> {
        let id = Uuid::new_v4();
        let state = SessionState::Idle;
        let created_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before 1970")
            .as_secs() as i64;
        self.connection.execute(
            "INSERT INTO sessions
                 (id, project_id, agent, title, cwd, state, created_at, worktree_path, worktree_branch)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id.to_string(),
                project_id.to_string(),
                agent,
                title,
                cwd,
                state.as_str(),
                created_at,
                worktree.map(|(path, _)| path),
                worktree.map(|(_, branch)| branch)
            ],
        )?;
        Ok(Session {
            id,
            project_id,
            agent: agent.to_string(),
            title: title.to_string(),
            cwd: cwd.to_string(),
            state,
            worktree: worktree.map(|(path, branch)| (path.to_owned(), branch.to_owned())),
            created_at,
        })
    }

    pub fn set_session_state(&self, id: Uuid, state: SessionState) -> Result<()> {
        self.connection.execute(
            "UPDATE sessions SET state = ?2 WHERE id = ?1",
            params![id.to_string(), state.as_str()],
        )?;
        Ok(())
    }

    pub fn close_session(&self, id: Uuid) -> Result<()> {
        self.connection.execute(
            "UPDATE sessions SET closed_at = unixepoch() WHERE id = ?1 AND closed_at IS NULL",
            params![id.to_string()],
        )?;
        Ok(())
    }

    pub fn close_orphaned_sessions(&self) -> Result<usize> {
        Ok(self.connection.execute(
            "UPDATE sessions SET closed_at = unixepoch() WHERE closed_at IS NULL",
            [],
        )?)
    }

    pub fn list_open_sessions(&self, project_id: Uuid) -> Result<Vec<Session>> {
        let mut statement = self.connection.prepare(
            "SELECT id, project_id, agent, title, cwd, state, created_at, worktree_path, worktree_branch
             FROM sessions WHERE project_id = ?1 AND closed_at IS NULL ORDER BY created_at",
        )?;
        let rows = statement.query_map(params![project_id.to_string()], map_session)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

fn map_project(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: parse_uuid(row, 0)?,
        name: row.get(1)?,
        root: row.get(2)?,
        is_git: row.get(3)?,
    })
}

fn map_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    let raw_state: String = row.get(5)?;
    let path: Option<String> = row.get(7)?;
    let branch: Option<String> = row.get(8)?;
    Ok(Session {
        id: parse_uuid(row, 0)?,
        project_id: parse_uuid(row, 1)?,
        agent: row.get(2)?,
        title: row.get(3)?,
        cwd: row.get(4)?,
        state: SessionState::parse(&raw_state).unwrap_or_default(),
        worktree: path.zip(branch),
        created_at: row.get(6)?,
    })
}

fn parse_uuid(row: &rusqlite::Row<'_>, index: usize) -> rusqlite::Result<Uuid> {
    let raw: String = row.get(index)?;
    Uuid::parse_str(&raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(error))
    })
}

#[cfg(test)]
#[path = "store_tests.rs"]
mod tests;
