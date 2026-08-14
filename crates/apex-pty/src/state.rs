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
                tracing::warn!(%source, %error, "patron de estado invalido");
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
        self.push_tail(chunk);
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

    fn push_tail(&mut self, chunk: &[u8]) {
        self.tail.push_str(&strip_ansi(chunk));
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
    let mut chars = text.chars().peekable();

    while let Some(current) = chars.next() {
        if current != '\u{1b}' {
            if current != '\u{7}' && current != '\r' {
                out.push(current);
            }
            continue;
        }
        match chars.next() {
            Some('[') => {
                for follow in chars.by_ref() {
                    if follow.is_ascii_alphabetic() || follow == '~' {
                        break;
                    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn detector(blocked: &[&str], done: &[&str]) -> (StateDetector, Instant) {
        let now = Instant::now();
        let patterns = StatePatterns::compile(
            &blocked.iter().map(|s| (*s).to_string()).collect::<Vec<_>>(),
            &done.iter().map(|s| (*s).to_string()).collect::<Vec<_>>(),
        );
        (StateDetector::new(patterns, now).with_quiescence(Duration::from_millis(50)), now)
    }

    #[test]
    fn output_moves_the_session_to_working() {
        let (mut detector, now) = detector(&[], &[]);
        assert_eq!(detector.observe(b"algo", now), Some(SessionState::Working));
        assert_eq!(detector.state(), SessionState::Working);
    }

    #[test]
    fn repeated_output_does_not_re_announce_working() {
        let (mut detector, now) = detector(&[], &[]);
        detector.observe(b"uno", now);
        assert_eq!(detector.observe(b"dos", now), None);
    }

    #[test]
    fn quiet_output_without_patterns_settles_on_idle() {
        let (mut detector, now) = detector(&[], &[]);
        detector.observe(b"algo", now);
        assert_eq!(detector.poll(now + Duration::from_millis(20)), None);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Idle));
    }

    #[test]
    fn a_blocked_pattern_settles_on_blocked_once_quiet() {
        let (mut detector, now) = detector(&["Do you want to proceed"], &[]);
        detector.observe(b"Do you want to proceed?", now);
        assert_eq!(detector.state(), SessionState::Working);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Blocked));
    }

    #[test]
    fn a_done_pattern_settles_on_done_once_quiet() {
        let (mut detector, now) = detector(&[], &["Total cost:"]);
        detector.observe(b"Total cost: $1.20", now);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Done));
    }

    #[test]
    fn blocked_wins_over_done_in_the_same_tail() {
        let (mut detector, now) = detector(&["\\(y/n\\)"], &["Total cost:"]);
        detector.observe(b"Total cost: $1.20\nBorrar? (y/n)", now);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Blocked));
    }

    #[test]
    fn answering_a_prompt_returns_the_session_to_working() {
        let (mut detector, now) = detector(&["\\(y/n\\)"], &[]);
        detector.observe(b"Seguir? (y/n)", now);
        detector.poll(now + Duration::from_millis(80));
        assert_eq!(detector.state(), SessionState::Blocked);

        let later = now + Duration::from_millis(100);
        assert_eq!(detector.observe(b"trabajando...", later), Some(SessionState::Working));
    }

    #[test]
    fn a_prompt_that_scrolled_out_of_the_tail_stops_counting() {
        let (mut detector, now) = detector(&["MARCA-DE-PROMPT"], &[]);
        detector.observe(b"MARCA-DE-PROMPT", now);
        detector.observe(&vec![b'x'; TAIL_LIMIT + 100], now);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Idle));
    }

    #[test]
    fn patterns_match_through_ansi_colouring() {
        let (mut detector, now) = detector(&["Do you want to proceed"], &[]);
        detector.observe(b"\x1b[1m\x1b[31mDo you\x1b[0m want to proceed\x1b[K", now);
        assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Blocked));
    }

    #[test]
    fn an_invalid_pattern_is_skipped_instead_of_breaking_the_detector() {
        let patterns = StatePatterns::compile(&["(sin cerrar".to_string()], &[]);
        assert!(patterns.blocked.is_empty());
    }

    #[test]
    fn an_exited_session_lands_on_done_whatever_the_code() {
        let (mut ended, _) = detector(&[], &[]);
        assert_eq!(ended.finish(), Some(SessionState::Done));
        assert_eq!(ended.finish(), None);
    }

    #[test]
    fn a_blocked_session_that_exits_stops_being_blocked() {
        let (mut waiting, now) = detector(&["\\(y/n\\)"], &[]);
        waiting.observe(b"Seguir? (y/n)", now);
        waiting.poll(now + Duration::from_millis(80));
        assert_eq!(waiting.state(), SessionState::Blocked);
        assert_eq!(waiting.finish(), Some(SessionState::Done));
    }

    #[test]
    fn ansi_stripping_keeps_the_readable_text() {
        assert_eq!(strip_ansi(b"\x1b[31mrojo\x1b[0m normal"), "rojo normal");
        assert_eq!(strip_ansi(b"\x1b]0;titulo\x07visible"), "visible");
        assert_eq!(strip_ansi(b"linea\r\nsiguiente"), "linea\nsiguiente");
    }
}
