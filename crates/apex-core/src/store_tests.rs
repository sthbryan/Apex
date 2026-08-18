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
        .insert_session(project.id, "claude", "refactor", "/tmp/apex", None)
        .expect("session");

    assert_eq!(session.state, SessionState::Idle);
    assert_eq!(store.list_open_sessions(project.id).expect("open"), vec![session]);
}

#[test]
fn session_state_survives_a_roundtrip() {
    let store = store();
    let dir = tempfile::tempdir().expect("tempdir");
    let project = store.open_project(dir.path()).expect("project");
    let session = store.insert_session(project.id, "codex", "tests", "/tmp", None).expect("session");

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
    store.insert_session(apex.id, "claude", "a", "/tmp", None).expect("session");

    assert!(store.list_open_sessions(other.id).expect("open").is_empty());
}

#[test]
fn closing_a_session_removes_it_from_the_open_list() {
    let store = store();
    let dir = tempfile::tempdir().expect("tempdir");
    let project = store.open_project(dir.path()).expect("project");
    let session = store.insert_session(project.id, "claude", "a", "/tmp", None).expect("session");

    store.close_session(session.id).expect("close");
    assert!(store.list_open_sessions(project.id).expect("open").is_empty());
}

#[test]
fn orphaned_sessions_from_a_previous_run_are_closed() {
    let store = store();
    let dir = tempfile::tempdir().expect("tempdir");
    let project = store.open_project(dir.path()).expect("project");
    store.insert_session(project.id, "claude", "a", "/tmp", None).expect("session");
    store.insert_session(project.id, "codex", "b", "/tmp", None).expect("session");

    assert_eq!(store.close_orphaned_sessions().expect("cleanup"), 2);
    assert_eq!(store.close_orphaned_sessions().expect("cleanup"), 0);
}

#[test]
fn a_session_needs_an_existing_project() {
    assert!(store().insert_session(Uuid::new_v4(), "claude", "a", "/tmp", None).is_err());
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

#[test]
fn deleting_a_project_takes_its_sessions_and_layout_with_it() {
    let store = store();
    let dir = tempfile::tempdir().expect("tempdir");
    let project = store.open_project(dir.path()).expect("project");
    store
        .insert_session(project.id, "claude", "refactor", "/tmp/apex", None)
        .expect("session");
    store.save_layout(project.id, "{\"tabs\":[]}").expect("save");

    store.delete_project(project.id).expect("delete");

    assert_eq!(store.project(project.id).expect("lookup"), None);
    assert_eq!(store.list_projects().expect("list"), vec![]);
    assert_eq!(store.load_layout(project.id).expect("layout"), None);
    assert_eq!(store.list_open_sessions(project.id).expect("sessions"), vec![]);
}
