use std::collections::{HashMap, HashSet};

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, Signal, System};

mod gpu;

pub use gpu::read_gpu_utilization;

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
            RefreshKind::nothing()
                .with_cpu(sysinfo::CpuRefreshKind::everything())
                .with_memory(sysinfo::MemoryRefreshKind::everything()),
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
        processes.sort_by_key(|entry| std::cmp::Reverse(entry.memory));

        TreeUsage {
            cpu_percent: processes.iter().map(|entry| entry.cpu_percent).sum(),
            memory: processes.iter().map(|entry| entry.memory).sum(),
            processes,
        }
    }

    pub fn is_alive(&self, pid: u32) -> bool {
        self.system.process(Pid::from_u32(pid)).is_some()
    }

    pub fn kill(&self, pid: u32) -> bool {
        self.system
            .process(Pid::from_u32(pid))
            .and_then(|process| process.kill_with(Signal::Term))
            .unwrap_or(false)
    }

    fn descendants(&self, root: u32) -> HashSet<u32> {
        let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
        for (pid, process) in self.system.processes() {
            if process.thread_kind().is_some() {
                continue;
            }
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
#[path = "lib_tests.rs"]
mod tests;
