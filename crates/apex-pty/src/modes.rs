use std::collections::BTreeMap;

const KEPT: [u16; 10] = [1, 7, 25, 1000, 1002, 1003, 1004, 1006, 1049, 2004];
const ALT_SCREEN: u16 = 1049;
const CURSOR: u16 = 25;
const PARAM_CAP: usize = 64;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Scan {
    Text,
    Escape,
    Bracket,
    Private,
}

pub struct ModeWatcher {
    scan: Scan,
    params: Vec<u8>,
    seen: BTreeMap<u16, bool>,
}

impl Default for ModeWatcher {
    fn default() -> Self {
        Self { scan: Scan::Text, params: Vec::new(), seen: BTreeMap::new() }
    }
}

impl ModeWatcher {
    pub fn watch(&mut self, chunk: &[u8]) {
        for byte in chunk {
            self.step(*byte);
        }
    }

    pub fn prelude(&self) -> Vec<u8> {
        let mut out = Vec::new();
        if self.seen.get(&ALT_SCREEN) == Some(&true) {
            push_mode(&mut out, ALT_SCREEN, true);
        }
        for (code, on) in &self.seen {
            if *code == ALT_SCREEN || !on {
                continue;
            }
            push_mode(&mut out, *code, true);
        }
        if self.seen.get(&CURSOR) == Some(&false) {
            push_mode(&mut out, CURSOR, false);
        }
        out
    }

    fn step(&mut self, byte: u8) {
        if byte == 0x1b {
            self.scan = Scan::Escape;
            return;
        }
        match self.scan {
            Scan::Text => {}
            Scan::Escape => self.scan = if byte == b'[' { Scan::Bracket } else { Scan::Text },
            Scan::Bracket => {
                if byte == b'?' {
                    self.params.clear();
                    self.scan = Scan::Private;
                } else {
                    self.scan = Scan::Text;
                }
            }
            Scan::Private => {
                if byte.is_ascii_digit() || byte == b';' {
                    if self.params.len() < PARAM_CAP {
                        self.params.push(byte);
                    }
                    return;
                }
                if byte == b'h' || byte == b'l' {
                    self.note(byte == b'h');
                }
                self.scan = Scan::Text;
            }
        }
    }

    fn note(&mut self, on: bool) {
        for field in self.params.split(|byte| *byte == b';') {
            let Ok(text) = std::str::from_utf8(field) else {
                continue;
            };
            let Ok(code) = text.parse::<u16>() else {
                continue;
            };
            if KEPT.contains(&code) {
                self.seen.insert(code, on);
            }
        }
        self.params.clear();
    }
}

fn push_mode(out: &mut Vec<u8>, code: u16, on: bool) {
    out.extend_from_slice(b"\x1b[?");
    out.extend_from_slice(code.to_string().as_bytes());
    out.push(if on { b'h' } else { b'l' });
}

#[cfg(test)]
#[path = "modes_tests.rs"]
mod tests;
