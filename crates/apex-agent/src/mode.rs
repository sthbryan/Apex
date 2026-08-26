use serde::{Deserialize, Serialize};

const READING: &[&str] = &["read", "search", "find", "fetch", "ask"];

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Chat,
    Plan,
    #[default]
    Auto,
}

impl Mode {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_lowercase().as_str() {
            "chat" => Some(Self::Chat),
            "plan" => Some(Self::Plan),
            "auto" => Some(Self::Auto),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Chat => "chat",
            Self::Plan => "plan",
            Self::Auto => "auto",
        }
    }

    pub fn allows(self, tool: &str) -> bool {
        match self {
            Self::Auto => true,
            Self::Chat => READING.contains(&tool),
            Self::Plan => READING.contains(&tool) || tool == "todo",
        }
    }

    pub fn hint(self) -> &'static str {
        match self {
            Self::Chat => {
                "You are in chat mode. You can read, search and fetch, and nothing else. You cannot change a file or run a command, so when you are asked to change something, say what you would change instead of trying."
            }
            Self::Plan => {
                "You are in plan mode. You can read, search, fetch and keep a todo list, and nothing else. You cannot change a file or run a command. Work out what should happen and lay it out as steps, do not carry it out."
            }
            Self::Auto => "",
        }
    }
}

#[cfg(test)]
#[path = "mode_tests.rs"]
mod tests;
