use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Result, bail};
use apex_core::{AgentProfile, BinaryResolver, ProfileSet, QuotaSource};
use apex_metrics::Sampler;
use apex_proto::{
    ApexUsage, MetricsSnapshot, ProcessUsage, QuotaReport, QuotaWindow, SessionUsage, SystemUsage,
};
use apex_quota::{Prepared, QuotaCache, read_first};
use tokio::sync::{Mutex, RwLock};
use tokio::task::{JoinHandle, JoinSet};
use uuid::Uuid;

use crate::services::sessions::LiveSession;

pub struct MetricsService {
    sampler: Arc<Mutex<Sampler>>,
    sessions: Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>>,
    acp: Arc<crate::services::acp::AcpRegistry>,
    quotas: Arc<Mutex<QuotaCache>>,
    profiles: ProfileSet,
    resolver: Arc<Mutex<BinaryResolver>>,
    base_env: BTreeMap<String, String>,
    running: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl MetricsService {
    pub fn new(
        sampler: Arc<Mutex<Sampler>>,
        sessions: Arc<RwLock<HashMap<Uuid, Arc<LiveSession>>>>,
        quotas: Arc<Mutex<QuotaCache>>,
        profiles: ProfileSet,
        resolver: Arc<Mutex<BinaryResolver>>,
        base_env: BTreeMap<String, String>,
        acp: Arc<crate::services::acp::AcpRegistry>,
    ) -> Self {
        Self {
            sampler,
            sessions,
            acp,
            quotas,
            profiles,
            resolver,
            base_env,
            running: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn read(&self, refresh_quota: bool) -> MetricsSnapshot {
        let (apex, sessions) = {
            let mut sampler = self.sampler.lock().await;
            sampler.refresh();

            let root = std::env::var("APEX_HOST_PID")
                .ok()
                .and_then(|pid| pid.parse::<u32>().ok())
                .unwrap_or_else(std::process::id);
            let apex_tree = sampler.tree_usage(root);
            let apex =
                ApexUsage { cpu_percent: apex_tree.cpu_percent, memory: apex_tree.memory as f64 };

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
            for (id, title, pid) in self.acp.running().await {
                let tree = sampler.tree_usage(pid);
                if tree.processes.is_empty() {
                    continue;
                }
                usage.push(SessionUsage {
                    id,
                    title,
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
            (apex, usage)
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

        let quotas = if refresh_quota {
            self.refresh_quotas().await
        } else {
            let cached = self.cached_quotas().await;
            if cached.is_empty() {
                self.kick_refresh().await;
            }
            cached
        };

        MetricsSnapshot { apex, system, sessions, quotas }
    }

    pub async fn kill_process(&self, pid: u32) -> Result<()> {
        let sampler = self.sampler.lock().await;
        if !sampler.kill(pid) {
            bail!("failed to kill process {pid}")
        }
        Ok(())
    }

    async fn cached_quotas(&self) -> Vec<QuotaReport> {
        let cache = self.quotas.lock().await;
        self.profiles
            .iter()
            .filter_map(|profile| {
                let ttl = profile
                    .quota
                    .as_ref()
                    .map(|config| Duration::from_secs(config.cache_ttl_secs.max(1)))
                    .unwrap_or(Duration::from_secs(900));
                cache.peek(&profile.name, ttl).flatten()
            })
            .map(proto_report)
            .collect()
    }

    async fn kick_refresh(&self) {
        let mut running = self.running.lock().await;
        if running.is_some() {
            return;
        }
        let handle = self.spawn_refresh();
        *running = Some(handle);
    }

    async fn refresh_quotas(&self) -> Vec<QuotaReport> {
        let handle = {
            let mut running = self.running.lock().await;
            match running.take() {
                Some(handle) => handle,
                None => self.spawn_refresh(),
            }
        };
        let _ = handle.await;
        self.cached_quotas().await
    }

    fn spawn_refresh(&self) -> JoinHandle<()> {
        let quotas = Arc::clone(&self.quotas);
        let profiles = self.profiles.clone();
        let resolver = Arc::clone(&self.resolver);
        let base_env = self.base_env.clone();
        let running = Arc::clone(&self.running);
        tokio::spawn(async move {
            run_quota_refresh(&profiles, &resolver, &quotas, &base_env).await;
            *running.lock().await = None;
        })
    }
}

async fn run_quota_refresh(
    profiles: &ProfileSet,
    resolver: &Mutex<BinaryResolver>,
    quotas: &Mutex<QuotaCache>,
    base_env: &BTreeMap<String, String>,
) {
    let mut targets: Vec<(String, Vec<Prepared>)> = Vec::new();
    for profile in profiles.iter() {
        let Some(config) = &profile.quota else {
            continue;
        };

        let prepared = {
            let mut resolver = resolver.lock().await;
            if resolver.resolve(&profile.command).is_none() {
                continue;
            }
            config
                .sources
                .iter()
                .filter_map(|source| prepare(source, profile, &mut resolver))
                .collect::<Vec<Prepared>>()
        };
        if prepared.is_empty() {
            continue;
        }
        targets.push((profile.name.clone(), prepared));
    }

    let mut set = JoinSet::new();
    for (name, sources) in targets {
        let env = base_env.clone();
        set.spawn(async move {
            let report = read_first(&name, &sources, &env).await;
            (name, report)
        });
    }
    while let Some(joined) = set.join_next().await {
        let Ok((name, report)) = joined else {
            continue;
        };
        quotas.lock().await.store(&name, report);
    }
}

fn prepare(
    source: &QuotaSource,
    profile: &AgentProfile,
    resolver: &mut BinaryResolver,
) -> Option<Prepared> {
    match source {
        QuotaSource::Native => Prepared::native(&profile.name, resolver.resolve(&profile.command)?),
    }
}

fn proto_report(report: apex_quota::QuotaReport) -> QuotaReport {
    QuotaReport {
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
    }
}
