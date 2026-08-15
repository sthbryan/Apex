use super::*;
use std::process::{Command, Stdio};

fn sampler() -> Sampler {
    let mut sampler = Sampler::new();
    std::thread::sleep(std::time::Duration::from_millis(250));
    sampler.refresh();
    sampler
}

#[test]
fn the_system_reports_plausible_totals() {
    let usage = sampler().system_usage();
    assert!(usage.memory_total > 0, "missing total memory");
    assert!(usage.memory_used > 0 && usage.memory_used <= usage.memory_total);
    assert!(usage.cores >= 1);
    assert!(usage.cpu_percent >= 0.0);
}

#[test]
fn our_own_process_is_alive_and_uses_memory() {
    let sampler = sampler();
    let me = std::process::id();
    assert!(sampler.is_alive(me));

    let usage = sampler.tree_usage(me);
    assert!(usage.memory > 0, "test process reports no memory");
    assert!(usage.processes.iter().any(|entry| entry.pid == me));
}

#[test]
fn a_child_process_counts_towards_its_parent_tree() {
    let mut child = Command::new("/bin/sh")
        .args(["-c", "sleep 3"])
        .stdout(Stdio::null())
        .spawn()
        .expect("spawn");
    std::thread::sleep(std::time::Duration::from_millis(300));

    let sampler = sampler();
    let tree = sampler.tree_usage(std::process::id());
    let found = tree.processes.iter().any(|entry| entry.pid == child.id());

    let _ = child.kill();
    let _ = child.wait();
    assert!(found, "child did not appear in the parent tree");
}

#[test]
fn an_unknown_pid_yields_an_empty_tree() {
    let tree = sampler().tree_usage(u32::MAX);
    assert_eq!(tree.memory, 0);
    assert!(tree.processes.is_empty());
}

#[test]
fn a_dead_pid_is_not_alive() {
    assert!(!sampler().is_alive(u32::MAX));
}

#[test]
fn killing_an_unknown_pid_reports_failure() {
    assert!(!sampler().kill(u32::MAX));
}

#[test]
fn processes_come_sorted_by_memory() {
    let tree = sampler().tree_usage(std::process::id());
    assert!(
        tree.processes.windows(2).all(|pair| pair[0].memory >= pair[1].memory),
        "not sorted by memory"
    );
}
