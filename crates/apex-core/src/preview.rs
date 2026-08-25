use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

pub const FOLDER: &str = ".apex/preview";

const TYPES: &[(&str, &str)] = &[
    ("avif", "image/avif"),
    ("css", "text/css; charset=utf-8"),
    ("gif", "image/gif"),
    ("htm", "text/html; charset=utf-8"),
    ("html", "text/html; charset=utf-8"),
    ("ico", "image/x-icon"),
    ("jpeg", "image/jpeg"),
    ("jpg", "image/jpeg"),
    ("js", "text/javascript; charset=utf-8"),
    ("json", "application/json"),
    ("map", "application/json"),
    ("md", "text/plain; charset=utf-8"),
    ("mjs", "text/javascript; charset=utf-8"),
    ("png", "image/png"),
    ("svg", "image/svg+xml"),
    ("txt", "text/plain; charset=utf-8"),
    ("wasm", "application/wasm"),
    ("webp", "image/webp"),
    ("woff", "font/woff"),
    ("woff2", "font/woff2"),
];

pub fn dir(cwd: &Path) -> PathBuf {
    cwd.join(".apex").join("preview")
}

pub fn ensure(cwd: &Path) -> Result<PathBuf> {
    let dir = dir(cwd);
    std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;
    let ignore = dir.join(".gitignore");
    if !ignore.exists() {
        std::fs::write(&ignore, "*\n").with_context(|| format!("writing {}", ignore.display()))?;
    }
    Ok(dir)
}

pub fn content_type(path: &Path) -> &'static str {
    const PLAIN: &str = "application/octet-stream";
    let Some(raw) = path.extension().and_then(|raw| raw.to_str()) else {
        return PLAIN;
    };
    let wanted = raw.to_ascii_lowercase();
    TYPES.iter().find(|(name, _)| *name == wanted).map_or(PLAIN, |(_, kind)| *kind)
}

#[cfg(test)]
#[path = "preview_tests.rs"]
mod tests;
