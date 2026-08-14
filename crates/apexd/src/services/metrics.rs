use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use anyhow::{Result, bail};
use apex_metrics::Sampler;
use apex_proto::{MetricsSnapshot, ProcessUsage, QuotaReport, QuotaWindow, SessionUsage, SystemUsage};
use apex_quota::QuotaCache;
use apex_core::{BinaryResolver, ProfileSet};
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use crate::sessions::LiveSession;

pub struct MetricsService {
    sampler: Arc<Mutex<Sampler>>,
    sessions: Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>>,
    quotas: Arc<Mutex<QuotaCache>>,
    profiles: ProfileSet,
    resolver: Arc<Mutex<BinaryResolver>>,
    base_env: BTreeMap<String, String>,
}

impl MetricsService {
    pub fn new(
        sampler: Arc<Mutex<Sampler>>,
        sessions: Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>>,
        quotas: Arc<Mutex<QuotaCache>>,
        profiles: ProfileSet,
        resolver: Arc<Mutex<BinaryResolver>>,
        base_env: BTreeMap<String, String>,
    ) -> Self {
        Self { sampler, sessions, quotas, profiles, resolver, base_env }
    }

    pub async fn read(&self, refresh_quota: bool) -> MetricsSnapshot {
        let sessions = {
            let mut sampler = self.sampler.lock().await;
            sampler.refresh();

            let live = self.sessions.read().await;
            let mut usage = Vec::with_capacity(live.len());
            for (id, session) in live.iter() {
                let Some(pid) = session.process.pid() else {
                    continue;
                };
                let tree = sampler.tree_usage(pid);
                if tree.processes.is_empty() {
                    continue;
                }
                usage.push(SessionUsage {
                    id: *id,
                    title: session.summary.lock().await.title.clone(),
                    cpu_percent: tree.cpu_percent,
                    memory: tree.memory as f64,
                    processes: tree
                        .processes
                        .into_iter()
                        .map(|entry| ProcessUsage {
                            pid: entry.pid,
                            name: entry.name,
                            cpu_percent: entry.cpu_percent,
                            memory: entry.memory as f64,
                        })
                        .collect(),
                });
            }
            usage.sort_by(|left, right| right.memory.total_cmp(&left.memory));
            usage
        };

        let system = {
            let sampler = self.sampler.lock().await;
            let raw = sampler.system_usage();
            SystemUsage {
                cpu_percent: raw.cpu_percent,
                gpu_percent: apex_metrics::read_gpu_utilization(),
                memory_used: raw.memory_used as f64,
                memory_total: raw.memory_total as f64,
                swap_used: raw.swap_used as f64,
                swap_total: raw.swap_total as f64,
                cores: raw.cores as u32,
            }
        };

        MetricsSnapshot { system, sessions, quotas: self.read_quotas(refresh_quota).await }
    }

    pub async fn kill_process(&self, pid: u32) -> Result<()> {
        let sampler = self.sampler.lock().await;
        if !sampler.kill(pid) {
            bail!("failed to kill process {pid}")
        }
        Ok(())
    }

    async fn read_quotas(&self, force: bool) -> Vec<QuotaReport> {
        let mut reports = Vec::new();
        for profile in self.profiles.iter() {
            let Some(config) = &profile.quota else {
                continue;
            };

            let binary = {
                let mut resolver = self.resolver.lock().await;
                if resolver.resolve(&profile.command).is_none() {
                    continue;
                }
                match resolver.resolve(&config.command) {
                    Some(binary) => binary,
                    None => continue,
                }
            };

            let mut cache = self.quotas.lock().await;
            let Some(report) = cache.read(profile, binary, &self.base_env, force).await else {
                continue;
            };
            reports.push(QuotaReport {
                agent: report.agent,
                windows: report
                    .windows
                    .into_iter()
                    .map(|window| QuotaWindow {
                        label: window.label,
                        used_percent: window.used_percent,
                        expected_percent: window.expected_percent,
                        lasts_to_reset: window.lasts_to_reset,
                        eta_seconds: window
                            .eta_seconds
                            .map(|seconds| seconds.min(u64::from(u32::MAX)) as u32),
                        resets_at: window.resets_at,
                        reset_description: window.reset_description,
                    })
                    .collect(),
                updated_at: report.updated_at,
            });
        }
        reports
    }
}
