use std::collections::BTreeMap;
use std::path::Path;

use anyhow::Result;
use serde::Deserialize;

pub const MANUAL_TASKS: &str = ".apex/tasks.toml";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Package,
    Make,
    Just,
    Cargo,
    Manual,
}

impl Source {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Package => "package.json",
            Self::Make => "Makefile",
            Self::Just => "justfile",
            Self::Cargo => "Cargo.toml",
            Self::Manual => MANUAL_TASKS,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub name: String,
    pub command: String,
    pub source: Source,
}

pub fn discover(root: &Path) -> Vec<Task> {
    let mut tasks = Vec::new();
    tasks.extend(from_package(root));
    tasks.extend(from_make(root));
    tasks.extend(from_just(root));
    tasks.extend(from_cargo(root));
    tasks.extend(from_manual(root));

    tasks.sort_by(|left, right| left.name.cmp(&right.name));
    tasks.dedup_by(|left, right| left.name == right.name);
    tasks
}

pub fn package_runner(root: &Path) -> &'static str {
    for (lockfile, runner) in [
        ("bun.lock", "bun"),
        ("bun.lockb", "bun"),
        ("pnpm-lock.yaml", "pnpm"),
        ("yarn.lock", "yarn"),
    ] {
        if root.join(lockfile).is_file() {
            return runner;
        }
    }
    "npm"
}

fn from_package(root: &Path) -> Vec<Task> {
    #[derive(Deserialize)]
    struct Manifest {
        #[serde(default)]
        scripts: BTreeMap<String, String>,
    }

    let Ok(raw) = std::fs::read(root.join("package.json")) else {
        return Vec::new();
    };
    let Ok(manifest) = serde_json::from_slice::<Manifest>(&raw) else {
        return Vec::new();
    };

    let runner = package_runner(root);
    manifest
        .scripts
        .into_keys()
        .map(|name| Task {
            command: format!("{runner} run {name}"),
            name,
            source: Source::Package,
        })
        .collect()
}

fn from_make(root: &Path) -> Vec<Task> {
    let Ok(text) = std::fs::read_to_string(root.join("Makefile")) else {
        return Vec::new();
    };

    text.lines()
        .filter_map(|line| {
            if line.starts_with([' ', '\t', '#', '.']) {
                return None;
            }
            let (target, rest) = line.split_once(':')?;
            if rest.starts_with('=') || target.contains(['=', '$', '(']) {
                return None;
            }
            let target = target.trim();
            (!target.is_empty() && !target.contains(char::is_whitespace)).then(|| Task {
                name: target.to_owned(),
                command: format!("make {target}"),
                source: Source::Make,
            })
        })
        .collect()
}

fn from_just(root: &Path) -> Vec<Task> {
    let text = ["justfile", ".justfile", "Justfile"]
        .iter()
        .find_map(|name| std::fs::read_to_string(root.join(name)).ok());
    let Some(text) = text else {
        return Vec::new();
    };

    text.lines()
        .filter_map(|line| {
            if line.starts_with([' ', '\t', '#', '@']) {
                return None;
            }
            let (head, rest) = line.split_once(':')?;
            if rest.starts_with('=') {
                return None;
            }
            let name = head.split_whitespace().next()?;
            (!name.is_empty()).then(|| Task {
                name: name.to_owned(),
                command: format!("just {name}"),
                source: Source::Just,
            })
        })
        .collect()
}

fn from_cargo(root: &Path) -> Vec<Task> {
    if !root.join("Cargo.toml").is_file() {
        return Vec::new();
    }
    ["build", "test", "run"]
        .iter()
        .map(|name| Task {
            name: format!("cargo {name}"),
            command: format!("cargo {name}"),
            source: Source::Cargo,
        })
        .collect()
}

fn from_manual(root: &Path) -> Vec<Task> {
    #[derive(Deserialize)]
    struct Manual {
        #[serde(default)]
        tasks: BTreeMap<String, String>,
    }

    let Ok(text) = std::fs::read_to_string(root.join(MANUAL_TASKS)) else {
        return Vec::new();
    };
    let Ok(manual) = toml::from_str::<Manual>(&text) else {
        return Vec::new();
    };

    manual
        .tasks
        .into_iter()
        .map(|(name, command)| Task { name, command, source: Source::Manual })
        .collect()
}

pub fn detect_port(output: &str) -> Option<u16> {
    let mut found = None;
    for line in output.lines().rev().take(200) {
        for marker in ["http://localhost:", "http://127.0.0.1:", "http://0.0.0.0:"] {
            if let Some(rest) = line.split(marker).nth(1) {
                let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
                if let Ok(port) = digits.parse::<u16>() {
                    return Some(port);
                }
            }
        }
        if found.is_none()
            && let Some(rest) = line.split("port ").nth(1)
        {
            let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
            found = digits.parse::<u16>().ok();
        }
    }
    found
}

pub fn write_manual(root: &Path, tasks: &BTreeMap<String, String>) -> Result<()> {
    let path = root.join(MANUAL_TASKS);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let body = tasks
        .iter()
        .map(|(name, command)| format!("{name} = {}", toml::to_string(command).unwrap_or_default()))
        .collect::<Vec<_>>()
        .join("");
    std::fs::write(path, format!("[tasks]\n{body}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
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
}
