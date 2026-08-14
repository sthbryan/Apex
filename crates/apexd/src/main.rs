mod mcp;
mod session;
mod sessions;
mod state;

use anyhow::{Context, Result};
use apex_core::ApexPaths;
use apex_proto::{Connection, Listener, UnixTransport};

#[tokio::main]
async fn main() -> Result<()> {
    let paths = ApexPaths::discover()?;
    if let Some(session) = mcp_request()? {
        return mcp::run(&paths.socket, session).await;
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

    loop {
        tokio::select! {
            accepted = transport.accept() => {
                let (stream, peer) = accepted.context("accepting connection")?;
                let manager = manager.clone();
                tokio::spawn(session::serve(manager, Connection::new(stream, peer)));
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("apexd shutting down");
                return Ok(());
            }
        }
    }
}

fn mcp_request() -> Result<Option<Option<uuid::Uuid>>> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some("mcp") {
        return Ok(None);
    }
    let Some(session) = args.next().filter(|flag| flag == "--session").and(args.next()) else {
        return Ok(Some(None));
    };
    Ok(Some(Some(
        session.parse().with_context(|| format!("{session} is not a session id"))?,
    )))
}
