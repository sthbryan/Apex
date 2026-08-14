use std::path::Path;

use anyhow::{Context, Result};
use apex_proto::SessionState;
use rusqlite::{Connection, OptionalExtension, params};
use uuid::Uuid;

const MIGRATIONS: &[&str] = &[
    include_str!("migrations/0001_initial.sql"),
    include_str!("migrations/0002_projects.sql"),
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
        is_git: row.get(3)?,
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

    fn project_dir(name: &str) -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir_all(dir.path().join(name)).expect("subdir");
        dir
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
        first.open_project(dir.path()).expect("project");
        drop(first);

        let second = Store::open(&path).expect("reopen");
        assert_eq!(second.schema_version().expect("version"), MIGRATIONS.len());
        assert_eq!(second.list_projects().expect("projects").len(), 1);
    }

    #[test]
    fn a_project_takes_its_name_from_the_folder() {
        let dir = project_dir("my-repo");
        let project = store().open_project(&dir.path().join("my-repo")).expect("project");
        assert_eq!(project.name, "my-repo");
        assert!(!project.is_git);
    }

    #[test]
    fn a_folder_with_git_is_marked_as_such() {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::create_dir_all(dir.path().join(".git")).expect("git");
        assert!(store().open_project(dir.path()).expect("project").is_git);
    }

    #[test]
    fn opening_the_same_folder_twice_returns_the_same_project() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let first = store.open_project(dir.path()).expect("first");
        let second = store.open_project(dir.path()).expect("second");
        assert_eq!(first.id, second.id);
        assert_eq!(store.list_projects().expect("projects").len(), 1);
    }

    #[test]
    fn reopening_a_folder_picks_up_that_it_became_a_repo() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        assert!(!store.open_project(dir.path()).expect("first").is_git);

        std::fs::create_dir_all(dir.path().join(".git")).expect("git");
        assert!(store.open_project(dir.path()).expect("second").is_git);
    }

    #[test]
    fn reopening_a_project_moves_it_to_the_front_of_the_list() {
        let store = store();
        let first = tempfile::tempdir().expect("tempdir");
        let second = tempfile::tempdir().expect("tempdir");
        let older = store.open_project(first.path()).expect("older");
        let newer = store.open_project(second.path()).expect("newer");

        std::thread::sleep(std::time::Duration::from_millis(10));
        store.open_project(first.path()).expect("reopen");

        let listed = store.list_projects().expect("projects");
        assert_eq!(listed.first().map(|project| project.id), Some(older.id));
        assert_eq!(listed.get(1).map(|project| project.id), Some(newer.id));
    }

    #[test]
    fn a_project_can_be_fetched_by_id() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");
        assert_eq!(store.project(project.id).expect("lookup"), Some(project));
        assert_eq!(store.project(Uuid::new_v4()).expect("lookup"), None);
    }

    #[test]
    fn sessions_belong_to_a_project_and_start_idle() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");
        let session = store
            .insert_session(project.id, "claude", "refactor", "/tmp/apex")
            .expect("session");

        assert_eq!(session.state, SessionState::Idle);
        assert_eq!(store.list_open_sessions(project.id).expect("open"), vec![session]);
    }

    #[test]
    fn session_state_survives_a_roundtrip() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");
        let session = store.insert_session(project.id, "codex", "tests", "/tmp").expect("session");

        store.set_session_state(session.id, SessionState::Blocked).expect("update");
        let open = store.list_open_sessions(project.id).expect("open");
        assert_eq!(open[0].state, SessionState::Blocked);
    }

    #[test]
    fn sessions_of_other_projects_are_not_listed() {
        let store = store();
        let apex = tempfile::tempdir().expect("tempdir");
        let other = tempfile::tempdir().expect("tempdir");
        let apex = store.open_project(apex.path()).expect("apex");
        let other = store.open_project(other.path()).expect("other");
        store.insert_session(apex.id, "claude", "a", "/tmp").expect("session");

        assert!(store.list_open_sessions(other.id).expect("open").is_empty());
    }

    #[test]
    fn closing_a_session_removes_it_from_the_open_list() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");
        let session = store.insert_session(project.id, "claude", "a", "/tmp").expect("session");

        store.close_session(session.id).expect("close");
        assert!(store.list_open_sessions(project.id).expect("open").is_empty());
    }

    #[test]
    fn orphaned_sessions_from_a_previous_run_are_closed() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");
        store.insert_session(project.id, "claude", "a", "/tmp").expect("session");
        store.insert_session(project.id, "codex", "b", "/tmp").expect("session");

        assert_eq!(store.close_orphaned_sessions().expect("cleanup"), 2);
        assert_eq!(store.close_orphaned_sessions().expect("cleanup"), 0);
    }

    #[test]
    fn a_session_needs_an_existing_project() {
        assert!(store().insert_session(Uuid::new_v4(), "claude", "a", "/tmp").is_err());
    }

    #[test]
    fn a_layout_round_trips_and_overwrites() {
        let store = store();
        let dir = tempfile::tempdir().expect("tempdir");
        let project = store.open_project(dir.path()).expect("project");

        assert_eq!(store.load_layout(project.id).expect("empty"), None);
        store.save_layout(project.id, "{\"tabs\":[]}").expect("save");
        assert_eq!(
            store.load_layout(project.id).expect("load").as_deref(),
            Some("{\"tabs\":[]}")
        );

        store.save_layout(project.id, "{\"tabs\":[1]}").expect("overwrite");
        assert_eq!(
            store.load_layout(project.id).expect("load").as_deref(),
            Some("{\"tabs\":[1]}")
        );
    }

    #[test]
    fn a_layout_needs_an_existing_project() {
        assert!(store().save_layout(Uuid::new_v4(), "{}").is_err());
    }
}
