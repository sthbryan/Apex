use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
pub use apex_proto::{ApiEntry as Entry, ApiRequest as Request, ApiVariable as Variable};

pub const REQUESTS: &str = "requests";
pub const ENVIRONMENTS: &str = "environments";
pub const RUNS: &str = "runs";
pub const SECRETS: &str = ".env";

pub fn ensure(root: &Path) -> Result<()> {
    for folder in [REQUESTS, ENVIRONMENTS, RUNS] {
        let dir = root.join(folder);
        std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;
    }
    Ok(())
}

pub fn requests(root: &Path) -> Vec<String> {
    names(&root.join(REQUESTS))
}

pub fn entries(root: &Path) -> Vec<Entry> {
    requests(root)
        .into_iter()
        .map(|name| {
            let method = load(root, &name).map(|request| request.method).unwrap_or_default();
            Entry { name, method }
        })
        .collect()
}

pub fn environments(root: &Path) -> Vec<String> {
    names(&root.join(ENVIRONMENTS))
}

pub fn load(root: &Path, name: &str) -> Result<Request> {
    let path = request_path(root, name)?;
    let text =
        std::fs::read_to_string(&path).with_context(|| format!("{name} is not a saved request"))?;
    toml::from_str(&text).with_context(|| format!("{name} is not readable toml"))
}

pub fn save(root: &Path, name: &str, request: &Request) -> Result<()> {
    let path = request_path(root, name)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let text = toml::to_string_pretty(request).context("writing the request")?;
    std::fs::write(&path, text).with_context(|| format!("writing {}", path.display()))
}

pub fn remove(root: &Path, name: &str) -> Result<()> {
    let path = request_path(root, name)?;
    if !path.exists() {
        bail!("{name} is not a saved request")
    }
    std::fs::remove_file(&path).with_context(|| format!("removing {}", path.display()))
}

pub fn request_path(root: &Path, name: &str) -> Result<PathBuf> {
    Ok(root.join(REQUESTS).join(format!("{}.toml", stem(name)?)))
}

pub fn environment_path(root: &Path, name: &str) -> Result<PathBuf> {
    Ok(root.join(ENVIRONMENTS).join(format!("{}.toml", stem(name)?)))
}

pub fn run_path(root: &Path, name: &str) -> Result<PathBuf> {
    Ok(root.join(RUNS).join(format!("{}.json", stem(name)?)))
}

pub fn secrets_path(root: &Path) -> PathBuf {
    root.join(SECRETS)
}

pub fn read_environment(root: &Path, name: &str) -> Result<Vec<Variable>> {
    let raw = raw_environment(root, name)?;
    Ok(raw
        .into_iter()
        .map(|(name, value)| match value.strip_prefix('$') {
            Some(literal) if literal.starts_with('$') => {
                Variable { name, value: literal.to_owned(), secret: false }
            }
            Some(_) => Variable { name, value: String::new(), secret: true },
            None => Variable { name, value, secret: false },
        })
        .collect())
}

pub fn write_environment(root: &Path, name: &str, variables: &[Variable]) -> Result<()> {
    let path = environment_path(root, name)?;
    let held = secrets(root);
    let mut fresh: Vec<(String, String)> = Vec::new();
    let mut written: BTreeMap<String, String> = BTreeMap::new();

    for variable in variables {
        let key = key_of(variable.name.trim());
        if key.is_empty() {
            bail!("a variable needs a name")
        }
        if !variable.secret {
            written.insert(variable.name.trim().to_owned(), escape(&variable.value));
            continue;
        }
        let held_key = format!("{}_{key}", key_of(name));
        if variable.value.is_empty() && !held.contains_key(&held_key) {
            bail!("{} has no value yet, type the secret once", variable.name)
        }
        if !variable.value.is_empty() {
            fresh.push((held_key.clone(), variable.value.clone()));
        }
        written.insert(variable.name.trim().to_owned(), format!("${held_key}"));
    }

    for (key, value) in fresh {
        keep_secret(root, &key, &value)?;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let text = toml::to_string_pretty(&written).context("writing the environment")?;
    std::fs::write(&path, text).with_context(|| format!("writing {}", path.display()))
}

pub fn remove_environment(root: &Path, name: &str) -> Result<()> {
    let path = environment_path(root, name)?;
    if !path.exists() {
        bail!("{name} is not a saved environment")
    }
    std::fs::remove_file(&path).with_context(|| format!("removing {}", path.display()))
}

pub fn variables(root: &Path, environment: Option<&str>) -> Result<BTreeMap<String, String>> {
    let Some(name) = environment else {
        return Ok(BTreeMap::new());
    };
    let raw = raw_environment(root, name)?;
    let held = secrets(root);
    raw.into_iter()
        .map(|(key, value)| {
            let settled = unwrap(&value, &held)
                .with_context(|| format!("{key} in the {name} environment"))?;
            Ok((key, settled))
        })
        .collect()
}

pub fn secrets(root: &Path) -> BTreeMap<String, String> {
    let Ok(text) = std::fs::read_to_string(secrets_path(root)) else {
        return BTreeMap::new();
    };
    text.lines().filter_map(read_secret).collect()
}

pub fn fill(text: &str, variables: &BTreeMap<String, String>) -> Result<String> {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(at) = rest.find("{{") {
        out.push_str(&rest[..at]);
        let after = &rest[at + 2..];
        let Some(end) = after.find("}}") else { bail!("a {{{{ is never closed") };
        let name = after[..end].trim();
        let value = variables
            .get(name)
            .with_context(|| format!("{name} has no value, set it in the environment"))?;
        out.push_str(value);
        rest = &after[end + 2..];
    }
    out.push_str(rest);
    Ok(out)
}

pub fn apply(request: &Request, variables: &BTreeMap<String, String>) -> Result<Request> {
    let headers = request
        .headers
        .iter()
        .map(|(key, value)| {
            let filled = fill(value, variables).with_context(|| format!("in the {key} header"))?;
            Ok((key.clone(), filled))
        })
        .collect::<Result<BTreeMap<String, String>>>()?;
    Ok(Request {
        method: request.method.to_uppercase(),
        url: fill(&request.url, variables).context("in the url")?,
        headers,
        body: request
            .body
            .as_deref()
            .map(|body| fill(body, variables).context("in the body"))
            .transpose()?,
    })
}

fn raw_environment(root: &Path, name: &str) -> Result<BTreeMap<String, String>> {
    let path = environment_path(root, name)?;
    let text = std::fs::read_to_string(&path)
        .with_context(|| format!("{name} is not a saved environment"))?;
    toml::from_str(&text).with_context(|| format!("{name} is not readable toml"))
}

fn key_of(name: &str) -> String {
    name.chars()
        .map(
            |letter| if letter.is_ascii_alphanumeric() { letter.to_ascii_uppercase() } else { '_' },
        )
        .collect()
}

fn escape(value: &str) -> String {
    if value.starts_with('$') { format!("${value}") } else { value.to_owned() }
}

fn keep_secret(root: &Path, key: &str, value: &str) -> Result<()> {
    let quoted = quote(value)?;
    let path = secrets_path(root);
    let text = std::fs::read_to_string(&path).unwrap_or_default();
    let mut lines: Vec<String> = text.lines().map(str::to_owned).collect();
    let line = format!("{key}={quoted}");
    match lines.iter().position(|held| read_secret(held).is_some_and(|(held, _)| held == key)) {
        Some(at) => lines[at] = line,
        None => lines.push(line),
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating {}", parent.display()))?;
    }
    let mut body = lines.join("\n");
    body.push('\n');
    std::fs::write(&path, body).with_context(|| format!("writing {}", path.display()))?;
    lock(&path)
}

fn quote(value: &str) -> Result<String> {
    if value.contains(['\n', '\r']) {
        bail!("a secret cannot span lines")
    }
    let plain = !value.is_empty()
        && !value.contains(char::is_whitespace)
        && !value.contains('#')
        && !value.starts_with('"')
        && !value.starts_with('\'');
    if plain {
        return Ok(value.to_owned());
    }
    if value.contains('"') {
        bail!("a secret with spaces cannot also hold a double quote")
    }
    Ok(format!("\"{value}\""))
}

#[cfg(unix)]
fn lock(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .with_context(|| format!("locking {}", path.display()))
}

#[cfg(not(unix))]
fn lock(_path: &Path) -> Result<()> {
    Ok(())
}

fn unwrap(value: &str, held: &BTreeMap<String, String>) -> Result<String> {
    let Some(rest) = value.strip_prefix('$') else {
        return Ok(value.to_owned());
    };
    if let Some(literal) = rest.strip_prefix('$') {
        return Ok(format!("${literal}"));
    }
    held.get(rest).cloned().with_context(|| format!("{rest} is not in the .env file"))
}

fn read_secret(line: &str) -> Option<(String, String)> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let bare = trimmed.strip_prefix("export ").unwrap_or(trimmed);
    let (key, value) = bare.split_once('=')?;
    let key = key.trim();
    if key.is_empty() {
        return None;
    }
    Some((key.to_owned(), unquote(value.trim()).to_owned()))
}

fn unquote(value: &str) -> &str {
    for mark in ['"', '\''] {
        if let Some(inner) = value.strip_prefix(mark).and_then(|rest| rest.strip_suffix(mark)) {
            return inner;
        }
    }
    value
}

fn stem(name: &str) -> Result<&str> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        bail!("a request needs a name")
    }
    if trimmed.starts_with('.')
        || trimmed.contains(['/', '\\', '\0'])
        || trimmed.chars().any(char::is_control)
    {
        bail!("{name} is not a name, use letters, digits, dashes or spaces")
    }
    Ok(trimmed)
}

fn names(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut found: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| {
            let path = entry.path();
            (path.extension()? == "toml")
                .then(|| path.file_stem()?.to_str().map(str::to_owned))
                .flatten()
        })
        .collect();
    found.sort();
    found
}

#[cfg(test)]
#[path = "api_tests.rs"]
mod tests;
