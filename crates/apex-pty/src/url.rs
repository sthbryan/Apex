use crate::state::strip_ansi;

const TAIL: usize = 1024;
const MARKERS: [&str; 6] = [
    "http://localhost:",
    "http://127.0.0.1:",
    "http://0.0.0.0:",
    "https://localhost:",
    "https://127.0.0.1:",
    "https://0.0.0.0:",
];

#[derive(Default)]
pub struct UrlScanner {
    tail: String,
    found: Option<String>,
}

impl UrlScanner {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn scan(&mut self, chunk: &[u8]) -> Option<String> {
        self.tail.push_str(&strip_ansi(chunk));
        self.trim();

        let spoken = self.found.is_none();
        let url = from_marker(&self.tail)
            .or_else(|| if spoken { from_spoken(&self.tail) } else { None })?;

        if self.found.as_deref() == Some(url.as_str()) {
            return None;
        }
        self.found = Some(url.clone());
        Some(url)
    }

    fn trim(&mut self) {
        if self.tail.len() <= TAIL {
            return;
        }
        let mut cut = self.tail.len() - TAIL;
        while cut < self.tail.len() && !self.tail.is_char_boundary(cut) {
            cut += 1;
        }
        self.tail.drain(..cut);
    }
}

fn from_marker(text: &str) -> Option<String> {
    for line in text.lines().rev() {
        for marker in MARKERS {
            let Some(rest) = line.split(marker).nth(1) else {
                continue;
            };
            let port = digits(rest);
            if port.is_empty() {
                continue;
            }
            let (scheme, host) = marker.trim_end_matches(':').split_once("://")?;
            let host = if host == "0.0.0.0" { "127.0.0.1" } else { host };
            return Some(format!("{scheme}://{host}:{port}"));
        }
    }
    None
}

fn from_spoken(text: &str) -> Option<String> {
    for line in text.lines().rev() {
        let Some(rest) = line.split("port ").nth(1) else {
            continue;
        };
        let port = digits(rest);
        if !port.is_empty() {
            return Some(format!("http://localhost:{port}"));
        }
    }
    None
}

fn digits(text: &str) -> String {
    text.chars().take_while(char::is_ascii_digit).collect()
}

#[cfg(test)]
#[path = "url_tests.rs"]
mod tests;
