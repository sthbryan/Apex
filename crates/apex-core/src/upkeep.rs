use std::path::Path;
use std::time::{Duration, SystemTime};

use crate::paths::ApexPaths;

const SHOT_TTL: Duration = Duration::from_secs(3600);
const SHOT_KEPT: usize = 40;
const SHOT_BYTES: u64 = 100 * 1024 * 1024;

pub fn sweep(paths: &ApexPaths) {
    prune_shots(&paths.shots_dir());
    empty(&paths.mcp_dir());
}

pub fn prune_shots(dir: &Path) {
    prune_shots_at(dir, SystemTime::now());
}

fn prune_shots_at(dir: &Path, now: SystemTime) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut shots: Vec<(SystemTime, u64, std::path::PathBuf)> = entries
        .flatten()
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;
            Some((meta.modified().ok()?, meta.len(), entry.path()))
        })
        .collect();
    shots.sort_by_key(|(taken, _, _)| std::cmp::Reverse(*taken));

    let stale = now.checked_sub(SHOT_TTL);
    let mut room = SHOT_BYTES;
    for (index, (taken, size, path)) in shots.iter().enumerate() {
        let old = stale.is_some_and(|edge| *taken < edge);
        let crowded = index >= SHOT_KEPT || *size > room;
        if old || crowded {
            std::fs::remove_file(path).ok();
            continue;
        }
        room -= size;
    }
}

fn empty(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_type().is_ok_and(|kind| kind.is_file()) {
            std::fs::remove_file(entry.path()).ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shot(dir: &Path, name: &str) {
        std::fs::write(dir.join(name), [0u8; 16]).expect("writing a shot");
    }

    #[test]
    fn a_sweep_drops_the_stale_shots_and_every_leftover_config() {
        let home = tempfile::tempdir().expect("a home");
        let paths = ApexPaths::rooted_at(home.path());
        std::fs::create_dir_all(paths.shots_dir()).expect("a shots dir");
        std::fs::create_dir_all(paths.mcp_dir()).expect("an mcp dir");
        shot(&paths.shots_dir(), "taken.png");
        let config = paths.mcp_dir().join("a-session.json");
        std::fs::write(&config, "{}").expect("writing a config");

        sweep(&paths);
        assert!(paths.shots_dir().join("taken.png").is_file());
        assert!(!config.exists());

        prune_shots_at(&paths.shots_dir(), SystemTime::now() + SHOT_TTL * 2);
        assert!(!paths.shots_dir().join("taken.png").exists());
    }

    #[test]
    fn only_the_newest_shots_survive_the_cap() {
        let home = tempfile::tempdir().expect("a home");
        let dir = ApexPaths::rooted_at(home.path()).shots_dir();
        std::fs::create_dir_all(&dir).expect("a shots dir");
        for index in 0..SHOT_KEPT + 5 {
            shot(&dir, &format!("{index}.png"));
            std::thread::sleep(Duration::from_millis(2));
        }

        prune_shots(&dir);

        assert_eq!(std::fs::read_dir(&dir).expect("reading").count(), SHOT_KEPT);
        assert!(dir.join(format!("{}.png", SHOT_KEPT + 4)).is_file());
        assert!(!dir.join("0.png").exists());
    }
}
