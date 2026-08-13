mod session;
mod sessions;
mod state;

use anyhow::{Context, Result};
use apex_core::ApexPaths;
use apex_proto::{Connection, Listener, UnixTransport};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "apexd=info,apex_core=info".into()),
        )
        .init();

    let paths = ApexPaths::discover()?;
    let manager = state::bootstrap(&paths).await?;

    let mut transport = UnixTransport::bind(&paths.socket)
        .with_context(|| format!("escuchando en {}", paths.socket.display()))?;
    tracing::info!(transport = %transport.describe(), "apexd listo");

    loop {
        tokio::select! {
            accepted = transport.accept() => {
                let (stream, peer) = accepted.context("aceptando conexion")?;
                let manager = manager.clone();
                tokio::spawn(session::serve(manager, Connection::new(stream, peer)));
            }
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("apexd apagandose");
                return Ok(());
            }
        }
    }
}
