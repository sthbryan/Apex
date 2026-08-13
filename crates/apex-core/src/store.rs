use std::path::Path;

use anyhow::{Context, Result};
use apex_proto::SessionState;
use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_initial.sql")];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub root: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Session {
    pub id: Uuid,
    pub project_id: Uuid,
    pub agent: String,
    pub title: String,
    pub cwd: String,
    pub state: SessionState,
}

pub struct Store {
    connection: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("creando {}", parent.display()))?;
        }
        let connection =
            Connection::open(path).with_context(|| format!("abriendo {}", path.display()))?;
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
                .with_context(|| format!("aplicando migracion {}", index + 1))?;
            self.connection.pragma_update(None, "user_version", (index + 1) as i64)?;
        }
        Ok(())
    }

    pub fn schema_version(&self) -> Result<usize> {
        Ok(self.connection.pragma_query_value(None, "user_version", |row| {
            row.get::<_, i64>(0).map(|value| value as usize)
        })?)
    }

    pub fn upsert_project(&self, name: &str, root: &str) -> Result<Project> {
        if let Some(existing) = self.project_by_root(root)? {
            return Ok(existing);
        }
        let id = Uuid::new_v4();
        self.connection.execute(
            "INSERT INTO projects (id, name, root, created_at) VALUES (?1, ?2, ?3, unixepoch())",
            params![id.to_string(), name, root],
        )?;
        Ok(Project { id, name: name.to_string(), root: root.to_string() })
    }

    pub fn project_by_root(&self, root: &str) -> Result<Option<Project>> {
        Ok(self
            .connection
            .query_row(
                "SELECT id, name, root FROM projects WHERE root = ?1",
                params![root],
                map_project,
            )
            .optional()?)
    }

    pub fn list_projects(&self) -> Result<Vec<Project>> {
        let mut statement =
            self.connection.prepare("SELECT id, name, root FROM projects ORDER BY name")?;
        let rows = statement.query_map([], map_project)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn insert_session(
        &self,
        project_id: Uuid,
        agent: &str,
        title: &str,
        cwd: &str,
    ) -> Result<Session> {
        let id = Uuid::new_v4();
        let state = SessionState::Idle;
        self.connection.execute(
            "INSERT INTO sessions (id, project_id, agent, title, cwd, state, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, unixepoch())",
            params![
                id.to_string(),
                project_id.to_string(),
                agent,
                title,
                cwd,
                state.as_str()
            ],
        )?;
        Ok(Session {
            id,
            project_id,
            agent: agent.to_string(),
            title: title.to_string(),
            cwd: cwd.to_string(),
            state,
        })
    }

    pub fn set_session_state(&self, id: Uuid, state: SessionState) -> Result<()> {
        self.connection.execute(
            "UPDATE sessions SET state = ?2 WHERE id = ?1",
            params![id.to_string(), state.as_str()],
        )?;
        Ok(())
    }

    pub fn list_open_sessions(&self, project_id: Uuid) -> Result<Vec<Session>> {
        let mut statement = self.connection.prepare(
            "SELECT id, project_id, agent, title, cwd, state FROM sessions
             WHERE project_id = ?1 AND closed_at IS NULL ORDER BY created_at",
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
    })
}

fn map_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    let raw_state: String = row.get(5)?;
    Ok(Session {
        id: parse_uuid(row, 0)?,
        project_id: parse_uuid(row, 1)?,
        agent: row.get(2)?,
        title: row.get(3)?,
        cwd: row.get(4)?,
        state: SessionState::parse(&raw_state).unwrap_or_default(),
    })
}

fn parse_uuid(row: &rusqlite::Row<'_>, index: usize) -> rusqlite::Result<Uuid> {
    let raw: String = row.get(index)?;
    Uuid::parse_str(&raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(error))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> Store {
        Store::in_memory().expect("store")
    }

    #[test]
    fn migrations_run_to_the_latest_version() {
        assert_eq!(store().schema_version().expect("version"), MIGRATIONS.len());
    }

    #[test]
    fn migrations_are_idempotent_across_reopens() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("apex.sqlite");
        let first = Store::open(&path).expect("abrir");
        first.upsert_project("apex", "/tmp/apex").expect("proyecto");
        drop(first);

        let second = Store::open(&path).expect("reabrir");
        assert_eq!(second.schema_version().expect("version"), MIGRATIONS.len());
        assert_eq!(second.list_projects().expect("proyectos").len(), 1);
    }

    #[test]
    fn upserting_the_same_root_returns_the_same_project() {
        let store = store();
        let first = store.upsert_project("apex", "/tmp/apex").expect("primero");
        let second = store.upsert_project("otro nombre", "/tmp/apex").expect("segundo");
        assert_eq!(first.id, second.id);
        assert_eq!(store.list_projects().expect("proyectos").len(), 1);
    }

    #[test]
    fn sessions_belong_to_a_project_and_start_idle() {
        let store = store();
        let project = store.upsert_project("apex", "/tmp/apex").expect("proyecto");
        let session = store
            .insert_session(project.id, "claude", "refactor", "/tmp/apex")
            .expect("sesion");

        assert_eq!(session.state, SessionState::Idle);
        let open = store.list_open_sessions(project.id).expect("abiertas");
        assert_eq!(open, vec![session]);
    }

    #[test]
    fn session_state_survives_a_roundtrip() {
        let store = store();
        let project = store.upsert_project("apex", "/tmp/apex").expect("proyecto");
        let session = store
            .insert_session(project.id, "codex", "tests", "/tmp/apex")
            .expect("sesion");

        store.set_session_state(session.id, SessionState::Blocked).expect("actualizar");
        let open = store.list_open_sessions(project.id).expect("abiertas");
        assert_eq!(open[0].state, SessionState::Blocked);
    }

    #[test]
    fn sessions_of_other_projects_are_not_listed() {
        let store = store();
        let apex = store.upsert_project("apex", "/tmp/apex").expect("apex");
        let otro = store.upsert_project("otro", "/tmp/otro").expect("otro");
        store.insert_session(apex.id, "claude", "a", "/tmp/apex").expect("sesion");

        assert!(store.list_open_sessions(otro.id).expect("abiertas").is_empty());
    }

    #[test]
    fn a_session_needs_an_existing_project() {
        let store = store();
        let error = store.insert_session(Uuid::new_v4(), "claude", "a", "/tmp");
        assert!(error.is_err());
    }
}
