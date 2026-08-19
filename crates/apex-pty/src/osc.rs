use std::time::{Duration, Instant};

const BELL_DEBOUNCE: Duration = Duration::from_secs(2);
const MAX_SEQUENCE: usize = 4096;
const ESC: u8 = 0x1b;
const BEL: u8 = 0x07;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TerminalNotice {
    pub title: Option<String>,
    pub body: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    Plain,
    Escaped,
    Sequence,
    SequenceEscaped,
}

pub struct OscScanner {
    bell: bool,
    mode: Mode,
    pending: Vec<u8>,
    last_bell: Option<Instant>,
}

impl OscScanner {
    pub fn new(bell: bool) -> Self {
        Self { bell, mode: Mode::Plain, pending: Vec::new(), last_bell: None }
    }

    pub fn scan(&mut self, chunk: &[u8], now: Instant) -> Vec<TerminalNotice> {
        let mut found = Vec::new();
        for byte in chunk {
            match self.mode {
                Mode::Plain => self.plain(*byte, now, &mut found),
                Mode::Escaped => self.escaped(*byte),
                Mode::Sequence => self.sequence(*byte, &mut found),
                Mode::SequenceEscaped => self.sequence_escaped(*byte, &mut found),
            }
        }
        found
    }

    fn plain(&mut self, byte: u8, now: Instant, found: &mut Vec<TerminalNotice>) {
        match byte {
            ESC => self.mode = Mode::Escaped,
            BEL if self.bell && self.bell_is_due(now) => {
                found.push(TerminalNotice { title: None, body: String::new() });
            }
            _ => {}
        }
    }

    fn escaped(&mut self, byte: u8) {
        self.mode = if byte == b']' {
            self.pending.clear();
            Mode::Sequence
        } else {
            Mode::Plain
        };
    }

    fn sequence(&mut self, byte: u8, found: &mut Vec<TerminalNotice>) {
        match byte {
            BEL => self.close(found),
            ESC => self.mode = Mode::SequenceEscaped,
            _ => {
                self.pending.push(byte);
                if self.pending.len() > MAX_SEQUENCE {
                    self.pending.clear();
                    self.mode = Mode::Plain;
                }
            }
        }
    }

    fn sequence_escaped(&mut self, byte: u8, found: &mut Vec<TerminalNotice>) {
        if byte == b'\\' {
            self.close(found);
            return;
        }
        self.pending.clear();
        self.mode = if byte == b']' { Mode::Sequence } else { Mode::Plain };
    }

    fn close(&mut self, found: &mut Vec<TerminalNotice>) {
        let raw = String::from_utf8_lossy(&self.pending).into_owned();
        self.pending.clear();
        self.mode = Mode::Plain;
        if let Some(notice) = parse(&raw) {
            found.push(notice);
        }
    }

    fn bell_is_due(&mut self, now: Instant) -> bool {
        if self.last_bell.is_some_and(|last| now.duration_since(last) < BELL_DEBOUNCE) {
            return false;
        }
        self.last_bell = Some(now);
        true
    }
}

fn parse(raw: &str) -> Option<TerminalNotice> {
    let (code, rest) = raw.split_once(';')?;
    match code {
        "777" => {
            let payload = rest.strip_prefix("notify;")?;
            let (title, body) = payload.split_once(';').unwrap_or(("", payload));
            speak(Some(title), body)
        }
        "9" => {
            if rest.starts_with("4;") {
                return None;
            }
            speak(None, rest)
        }
        _ => None,
    }
}

fn speak(title: Option<&str>, body: &str) -> Option<TerminalNotice> {
    let body = body.trim();
    let title = title.map(str::trim).filter(|title| !title.is_empty());
    if body.is_empty() && title.is_none() {
        return None;
    }
    Some(TerminalNotice { title: title.map(str::to_string), body: body.to_string() })
}

#[cfg(test)]
#[path = "osc_tests.rs"]
mod tests;
