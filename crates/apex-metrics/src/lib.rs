use std::collections::{HashMap, HashSet};

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct SystemUsage {
    pub cpu_percent: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub cores: usize,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ProcessUsage {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory: u64,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TreeUsage {
    pub cpu_percent: f32,
    pub memory: u64,
    pub processes: Vec<ProcessUsage>,
}

pub struct Sampler {
    system: System,
}

impl Default for Sampler {
    fn default() -> Self {
        Self::new()
    }
}

impl Sampler {
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(
            RefreshKind::nothing().with_cpu(sysinfo::CpuRefreshKind::everything()).with_memory(
                sysinfo::MemoryRefreshKind::everything(),
            ),
        );
        system.refresh_all();
        Self { system }
    }

    pub fn refresh(&mut self) {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
    }

    pub fn system_usage(&self) -> SystemUsage {
        let cores = self.system.cpus().len();
        SystemUsage {
            cpu_percent: self.system.global_cpu_usage(),
            memory_used: self.system.used_memory(),
            memory_total: self.system.total_memory(),
            swap_used: self.system.used_swap(),
            swap_total: self.system.total_swap(),
            cores,
        }
    }

    pub fn tree_usage(&self, root: u32) -> TreeUsage {
        let members = self.descendants(root);
        let mut processes: Vec<ProcessUsage> = members
            .iter()
            .filter_map(|pid| {
                let process = self.system.process(Pid::from_u32(*pid))?;
                Some(ProcessUsage {
                    pid: *pid,
                    name: process.name().to_string_lossy().to_string(),
                    cpu_percent: process.cpu_usage(),
                    memory: process.memory(),
                })
            })
            .collect();
        processes.sort_by(|left, right| right.memory.cmp(&left.memory));

        TreeUsage {
            cpu_percent: processes.iter().map(|entry| entry.cpu_percent).sum(),
            memory: processes.iter().map(|entry| entry.memory).sum(),
            processes,
        }
    }

    pub fn is_alive(&self, pid: u32) -> bool {
        self.system.process(Pid::from_u32(pid)).is_some()
    }

    fn descendants(&self, root: u32) -> HashSet<u32> {
        let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
        for (pid, process) in self.system.processes() {
            if let Some(parent) = process.parent() {
                children.entry(parent.as_u32()).or_default().push(pid.as_u32());
            }
        }

        let mut found = HashSet::new();
        let mut pending = vec![root];
        while let Some(current) = pending.pop() {
            if !found.insert(current) {
                continue;
            }
            if let Some(next) = children.get(&current) {
                pending.extend(next);
            }
        }
        found
    }
}

#[cfg(test)]
mod tests {
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
        assert!(usage.memory_total > 0, "sin memoria total");
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
        assert!(usage.memory > 0, "el proceso de test no reporta memoria");
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
        assert!(found, "el hijo no aparecio en el arbol del padre");
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
    fn processes_come_sorted_by_memory() {
        let tree = sampler().tree_usage(std::process::id());
        assert!(
            tree.processes.windows(2).all(|pair| pair[0].memory >= pair[1].memory),
            "no vinieron ordenados por memoria"
        );
    }
}
