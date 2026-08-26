use std::sync::OnceLock;

use anyhow::{Result, anyhow, bail};

const SERVICE: &str = "apex";

static OPENED: OnceLock<Result<(), String>> = OnceLock::new();

pub fn remember(account: &str, secret: &str) -> Result<()> {
    if secret.trim().is_empty() {
        bail!("there is no secret to keep")
    }
    Ok(entry(account)?.set_password(secret)?)
}

pub fn recall(account: &str) -> Result<Option<String>> {
    match entry(account)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring_core::Error::NoEntry) => Ok(None),
        Err(cause) => Err(cause.into()),
    }
}

pub fn forget(account: &str) -> Result<()> {
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
        Err(cause) => Err(cause.into()),
    }
}

fn entry(account: &str) -> Result<keyring_core::Entry> {
    if account.trim().is_empty() {
        bail!("a secret needs a name to be kept under")
    }
    ready()?;
    Ok(keyring_core::Entry::new(SERVICE, account)?)
}

fn ready() -> Result<()> {
    OPENED.get_or_init(open).clone().map_err(|reason| anyhow!("no keychain here: {reason}"))
}

fn open() -> Result<(), String> {
    if keyring_core::get_default_store().is_some() {
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    let store = apple_native_keyring_store::keychain::Store::new();
    #[cfg(target_os = "windows")]
    let store = windows_native_keyring_store::Store::new();
    #[cfg(all(unix, not(target_os = "macos")))]
    let store = zbus_secret_service_keyring_store::Store::new();

    keyring_core::set_default_store(store.map_err(|cause| cause.to_string())?);
    Ok(())
}

#[cfg(test)]
#[path = "keychain_tests.rs"]
mod tests;
