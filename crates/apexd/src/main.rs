use std::sync::Arc;
use std::sync::atomic::AtomicUsize;

use anyhow::{Context, Result};
use apex_core::ApexPaths;
use apex_proto::{Connection, Listener, UnixTransport};
use apexd::session;
use apexd::state;
use apexd::watchdog::{IDLE_POLL, watch_for_idle};

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
    let mut shutdown_rx = manager.quitting();

    let watchdog = tokio::spawn(watch_for_idle(Arc::clone(&clients), manager.clone(), IDLE_POLL));

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
                tokio::spawn(session::serve(manager, Connection::new(stream, peer), clients));
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
    Ok(Some(Some(session.parse().with_context(|| format!("{session} is not a session id"))?)))
}
