use std::sync::Arc;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use apexd::session;
use apexd::state;
use apex_core::ApexPaths;
use apex_proto::{Connection, Listener, UnixTransport};
use tokio::sync::watch;

const IDLE_POLL: Duration = Duration::from_secs(1);

#[tokio::main]
async fn main() -> Result<()> {
    let paths = ApexPaths::discover()?;
    if let Some(session) = mcp_request()? {
        return apexd::mcp::run(&paths.socket, session).await;
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "apexd=info,apex_core=info".into()),
        )
        .init();

    let manager = state::bootstrap(&paths).await?;

    let mut transport = UnixTransport::bind(&paths.socket)
        .with_context(|| format!("listening on {}", paths.socket.display()))?;
    tracing::info!(transport = %transport.describe(), "apexd ready");

    let clients = Arc::new(AtomicUsize::new(0));
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let watchdog = tokio::spawn(watch_for_idle(
        Arc::clone(&clients),
        manager.idle_grace(),
        shutdown_tx,
    ));

    let shutdown = || async {
        tracing::info!("apexd shutting down");
        manager.shutdown().await;
        watchdog.abort();
    };

    loop {
        tokio::select! {
            accepted = transport.accept() => {
                let (stream, peer) = accepted.context("accepting connection")?;
                let manager = manager.clone();
                let clients = Arc::clone(&clients);
                tokio::spawn(async move {
                    clients.fetch_add(1, Ordering::SeqCst);
                    session::serve(manager, Connection::new(stream, peer)).await;
                    clients.fetch_sub(1, Ordering::SeqCst);
                });
            }
            _ = tokio::signal::ctrl_c() => {
                shutdown().await;
                return Ok(());
            }
            _ = shutdown_rx.changed() => {
                if *shutdown_rx.borrow() {
                    shutdown().await;
                    return Ok(());
                }
            }
        }
    }
}

async fn watch_for_idle(
    clients: Arc<AtomicUsize>,
    idle_grace: Arc<AtomicU64>,
    shutdown_tx: watch::Sender<bool>,
) {
    let mut seen_client = false;
    let mut idle_since: Option<Instant> = None;

    loop {
        tokio::time::sleep(IDLE_POLL).await;

        let active = clients.load(Ordering::SeqCst);
        if active > 0 {
            seen_client = true;
            idle_since = None;
            continue;
        }

        if !seen_client {
            continue;
        }

        let grace = Duration::from_secs(idle_grace.load(Ordering::Relaxed));
        match idle_since {
            None => idle_since = Some(Instant::now()),
            Some(start) if start.elapsed() >= grace => {
                tracing::info!("no clients for {grace:?}, shutting down");
                let _ = shutdown_tx.send(true);
                return;
            }
            Some(_) => {}
        }
    }
}

fn mcp_request() -> Result<Option<Option<uuid::Uuid>>> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some("mcp") {
        return Ok(None);
    }
    let Some(session) = args
        .next()
        .filter(|flag| flag == "--session")
        .and_then(|_| args.next())
        .or_else(|| std::env::var("APEX_SESSION").ok())
    else {
        return Ok(Some(None));
    };
    Ok(Some(Some(
        session.parse().with_context(|| format!("{session} is not a session id"))?,
    )))
}
