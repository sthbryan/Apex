use std::path::Path;

const BUILTIN: &str = include_str!("../preamble.md");
const OWN: &str = "preamble.md";

pub fn read(agent_dir: &Path) -> String {
    match std::fs::read_to_string(agent_dir.join(OWN)) {
        Ok(own) if !own.trim().is_empty() => own,
        _ => BUILTIN.to_owned(),
    }
}

pub fn builtin() -> &'static str {
    BUILTIN
}

#[cfg(test)]
#[path = "preamble_tests.rs"]
mod tests;
