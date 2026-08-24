use anyhow::Result;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::link::Link;

pub async fn run(socket: &Path, session: Option<Uuid>) -> Result<()> {
    let mut daemon = Link::connect(socket).await?;
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let caller = apex_mcp::caller_for(&mut daemon, session, &cwd).await?;
    apex_mcp::serve(&mut daemon, &caller, tokio::io::stdin(), tokio::io::stdout()).await
}
