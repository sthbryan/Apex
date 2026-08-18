use std::time::{Duration, Instant};

use apex_proto::SessionState;
use regex::Regex;

pub const QUIESCENCE: Duration = Duration::from_millis(600);
const TAIL_LIMIT: usize = 4096;

#[derive(Debug, Default)]
pub struct StatePatterns {
    pub blocked: Vec<Regex>,
    pub done: Vec<Regex>,
}

impl StatePatterns {
    pub fn compile(blocked: &[String], done: &[String]) -> Self {
        Self { blocked: compile_all(blocked), done: compile_all(done) }
    }
}

fn compile_all(sources: &[String]) -> Vec<Regex> {
    sources
        .iter()
        .filter_map(|source| match Regex::new(source) {
            Ok(pattern) => Some(pattern),
            Err(error) => {
                tracing::warn!(%source, %error, "invalid state pattern");
                None
            }
        })
        .collect()
}

pub struct StateDetector {
    patterns: StatePatterns,
    quiescence: Duration,
    tail: String,
    last_output: Instant,
    resting: SessionState,
    state: SessionState,
}

impl StateDetector {
    pub fn new(patterns: StatePatterns, now: Instant) -> Self {
        Self {
            patterns,
            quiescence: QUIESCENCE,
            tail: String::new(),
            last_output: now,
            resting: SessionState::Idle,
            state: SessionState::Idle,
        }
    }

    pub fn with_quiescence(mut self, quiescence: Duration) -> Self {
        self.quiescence = quiescence;
        self
    }

    pub fn state(&self) -> SessionState {
        self.state
    }

    pub fn observe(&mut self, chunk: &[u8], now: Instant) -> Option<SessionState> {
        let visible = strip_ansi(chunk);
        if visible.trim().is_empty() {
            return None;
        }
        self.tail.push_str(&visible);
        self.trim_tail();
        self.last_output = now;
        self.resting = self.classify_tail();
        self.transition(SessionState::Working)
    }

    pub fn poll(&mut self, now: Instant) -> Option<SessionState> {
        if self.state != SessionState::Working {
            return None;
        }
        if now.duration_since(self.last_output) < self.quiescence {
            return None;
        }
        self.transition(self.resting)
    }

    pub fn finish(&mut self) -> Option<SessionState> {
        self.transition(SessionState::Done)
    }

    fn transition(&mut self, next: SessionState) -> Option<SessionState> {
        if self.state == next {
            return None;
        }
        self.state = next;
        Some(next)
    }

    fn classify_tail(&self) -> SessionState {
        if self.patterns.blocked.iter().any(|pattern| pattern.is_match(&self.tail)) {
            return SessionState::Blocked;
        }
        if self.patterns.done.iter().any(|pattern| pattern.is_match(&self.tail)) {
            return SessionState::Done;
        }
        SessionState::Idle
    }

    fn trim_tail(&mut self) {
        if self.tail.len() > TAIL_LIMIT {
            let cut = self.tail.len() - TAIL_LIMIT;
            let boundary = (cut..self.tail.len())
                .find(|index| self.tail.is_char_boundary(*index))
                .unwrap_or(self.tail.len());
            self.tail.drain(..boundary);
        }
    }
}

pub fn strip_ansi(raw: &[u8]) -> String {
    let text = String::from_utf8_lossy(raw);
    let mut out = String::with_capacity(text.len());
    let mut column = 0usize;
    let mut row = 0usize;
    let mut chars = text.chars().peekable();

    while let Some(current) = chars.next() {
        if current != '\u{1b}' {
            if current == '\n' {
                column = 0;
                row += 1;
                out.push(current);
            } else if current != '\u{7}' && current != '\r' {
                column += 1;
                out.push(current);
            }
            continue;
        }
        match chars.next() {
            Some('[') => {
                let mut params = String::new();
                let mut ending = None;
                for follow in chars.by_ref() {
                    if follow.is_ascii_alphabetic() || follow == '~' {
                        ending = Some(follow);
                        break;
                    }
                    params.push(follow);
                }
                match ending {
                    Some('C') | Some('X') => {
                        let target = column + first_param(&params);
                        pad_to(&mut out, &mut column, target);
                    }
                    Some('G') => pad_to(&mut out, &mut column, first_param(&params) - 1),
                    Some('H') | Some('f') => {
                        let (line, target) = position(&params);
                        if line != row {
                            row = line;
                            column = 0;
                            out.push('\n');
                        }
                        pad_to(&mut out, &mut column, target - 1);
                    }
                    _ => {}
                }
            }
            Some(']') => {
                while let Some(follow) = chars.next() {
                    if follow == '\u{7}' {
                        break;
                    }
                    if follow == '\u{1b}' {
                        chars.next();
                        break;
                    }
                }
            }
            Some('(') | Some(')') => {
                chars.next();
            }
            _ => {}
        }
    }
    out
}

fn pad_to(out: &mut String, column: &mut usize, target: usize) {
    if target > *column {
        out.extend(std::iter::repeat_n(' ', target - *column));
        *column = target;
    }
}

fn first_param(params: &str) -> usize {
    params.split(';').next().and_then(|value| value.parse::<usize>().ok()).unwrap_or(1).max(1)
}

fn position(params: &str) -> (usize, usize) {
    let mut parts = params.split(';');
    let line = parts.next().and_then(|value| value.parse::<usize>().ok()).unwrap_or(1).max(1);
    let column = parts.next().and_then(|value| value.parse::<usize>().ok()).unwrap_or(1).max(1);
    (line, column)
}

#[cfg(test)]
#[path = "state_tests.rs"]
mod tests;
