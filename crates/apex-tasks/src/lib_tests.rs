use super::*;

fn project() -> tempfile::TempDir {
    tempfile::tempdir().expect("tempdir")
}

#[test]
fn a_bare_folder_offers_nothing() {
    assert!(discover(project().path()).is_empty());
}

#[test]
fn scripts_become_tasks_run_with_the_package_manager_of_the_repo() {
    let dir = project();
    std::fs::write(
        dir.path().join("package.json"),
        r#"{"scripts":{"dev":"vite","build":"tsc && vite build"}}"#,
    )
    .expect("write");

    let npm = discover(dir.path());
    assert_eq!(npm[0].name, "build");
    assert_eq!(npm[0].command, "npm run build");

    std::fs::write(dir.path().join("bun.lock"), "").expect("write");
    let bun = discover(dir.path());
    assert_eq!(bun[1].command, "bun run dev");
    assert_eq!(bun[1].source, Source::Package);
}

#[test]
fn make_targets_are_read_without_taking_variables_along() {
    let dir = project();
    std::fs::write(
        dir.path().join("Makefile"),
        "CC = clang\n.PHONY: all\n\nall: build\n\t@echo hi\n\nbuild:\n\t$(CC) main.c\n",
    )
    .expect("write");

    let found = discover(dir.path());
    let names: Vec<&str> = found.iter().map(|task| task.name.as_str()).collect();
    assert_eq!(names, vec!["all", "build"]);
    assert_eq!(found[0].command, "make all");
}

#[test]
fn just_recipes_are_read_without_their_assignments() {
    let dir = project();
    std::fs::write(
        dir.path().join("justfile"),
        "export RUST_LOG := \"info\"\n\ndev port=\"3000\":\n    bun dev\n\ntest:\n    cargo test\n",
    )
    .expect("write");

    let found = discover(dir.path());
    let names: Vec<&str> = found.iter().map(|task| task.name.as_str()).collect();
    assert_eq!(names, vec!["dev", "test"]);
}

#[test]
fn a_cargo_project_gets_the_usual_three() {
    let dir = project();
    std::fs::write(dir.path().join("Cargo.toml"), "[package]\nname = \"x\"\n").expect("write");
    let found = discover(dir.path());
    let names: Vec<&str> = found.iter().map(|task| task.name.as_str()).collect();
    assert_eq!(names, vec!["cargo build", "cargo run", "cargo test"]);
}

#[test]
fn manual_tasks_win_over_a_discovered_one_with_the_same_name() {
    let dir = project();
    std::fs::write(dir.path().join("package.json"), r#"{"scripts":{"dev":"vite"}}"#)
        .expect("write");
    std::fs::create_dir_all(dir.path().join(".apex")).expect("dir");
    std::fs::write(
        dir.path().join(MANUAL_TASKS),
        "[tasks]\ndev = \"bun dev --host\"\nseed = \"bun run scripts/seed.ts\"\n",
    )
    .expect("write");

    let found = discover(dir.path());
    let dev = found.iter().find(|task| task.name == "dev").expect("dev");
    assert_eq!(dev.command, "npm run dev");
    assert_eq!(found.iter().filter(|task| task.name == "dev").count(), 1);
    assert!(found.iter().any(|task| task.name == "seed"));
}

#[test]
fn a_broken_manifest_is_ignored_instead_of_breaking_the_panel() {
    let dir = project();
    std::fs::write(dir.path().join("package.json"), "{ not json").expect("write");
    std::fs::write(dir.path().join("Cargo.toml"), "[package]\nname = \"x\"\n").expect("write");
    assert_eq!(discover(dir.path()).len(), 3);
}

#[test]
fn a_served_url_gives_away_the_port() {
    assert_eq!(detect_port("  ➜  Local:   http://localhost:5173/\n"), Some(5173));
    assert_eq!(detect_port("Listening on http://127.0.0.1:8080"), Some(8080));
    assert_eq!(detect_port("serving on port 3000 now"), Some(3000));
    assert_eq!(detect_port("compiled successfully"), None);
}
