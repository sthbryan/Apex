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
    pub group: Option<String>,
    pub risky: bool,
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
    regroup(&mut tasks);
    tasks
}

const RISKY_LINES: [&str; 8] = [
    "rm -rf",
    "rm -fr",
    "pkill",
    "killall",
    "cargo clean",
    "git clean",
    "reset --hard",
    "prune",
];

const RISKY_WORDS: [&str; 6] = ["clean", "kill", "nuke", "wipe", "destroy", "reset"];

pub fn is_risky(name: &str, body: &str) -> bool {
    let lowered = body.to_lowercase();
    if RISKY_LINES.iter().any(|marker| lowered.contains(marker)) {
        return true;
    }
    name.to_lowercase()
        .split(|letter: char| !letter.is_ascii_alphanumeric())
        .any(|word| RISKY_WORDS.contains(&word))
}

fn head(name: &str) -> &str {
    match name.find([':', ' ']) {
        Some(at) => &name[..at],
        None => name,
    }
}

fn regroup(tasks: &mut [Task]) {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for task in tasks.iter() {
        *counts.entry(head(&task.name).to_owned()).or_default() += 1;
    }
    for task in tasks.iter_mut() {
        let key = head(&task.name).to_owned();
        if counts.get(&key).copied().unwrap_or_default() > 1 {
            task.group = Some(key);
        }
    }
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
        .into_iter()
        .map(|(name, body)| Task {
            command: format!("{runner} run {name}"),
            risky: is_risky(&name, &body),
            name,
            source: Source::Package,
            group: None,
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
                group: None,
                risky: is_risky(target, target),
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
                group: None,
                risky: is_risky(name, name),
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
            group: None,
            risky: false,
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
        .map(|(name, command)| Task { risky: is_risky(&name, &command), name, command, source: Source::Manual, group: None })
        .collect()
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
#[path = "lib_tests.rs"]
mod tests;
