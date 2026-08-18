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
    assert_eq!(detector.observe(b"something", now), Some(SessionState::Working));
    assert_eq!(detector.state(), SessionState::Working);
}

#[test]
fn a_redraw_with_nothing_readable_is_not_work() {
    let (mut detector, now) = detector(&[], &[]);
    assert_eq!(detector.observe(b"\x1b[2K\x1b[1G\x1b[?25l", now), None);
    assert_eq!(detector.state(), SessionState::Idle);
}

#[test]
fn a_redraw_does_not_hold_a_session_in_working() {
    let (mut detector, now) = detector(&[], &[]);
    detector.observe(b"thinking", now);
    let later = now + Duration::from_millis(40);
    detector.observe(b"\x1b[2K\x1b[1G", later);
    assert_eq!(detector.poll(now + Duration::from_millis(60)), Some(SessionState::Idle));
}

#[test]
fn repeated_output_does_not_re_announce_working() {
    let (mut detector, now) = detector(&[], &[]);
    detector.observe(b"one", now);
    assert_eq!(detector.observe(b"two", now), None);
}

#[test]
fn quiet_output_without_patterns_settles_on_idle() {
    let (mut detector, now) = detector(&[], &[]);
    detector.observe(b"something", now);
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
    detector.observe(b"Total cost: $1.20\nDelete? (y/n)", now);
    assert_eq!(detector.poll(now + Duration::from_millis(80)), Some(SessionState::Blocked));
}

#[test]
fn answering_a_prompt_returns_the_session_to_working() {
    let (mut detector, now) = detector(&["\\(y/n\\)"], &[]);
    detector.observe(b"Continue? (y/n)", now);
    detector.poll(now + Duration::from_millis(80));
    assert_eq!(detector.state(), SessionState::Blocked);

    let later = now + Duration::from_millis(100);
    assert_eq!(detector.observe(b"working...", later), Some(SessionState::Working));
}

#[test]
fn a_prompt_that_scrolled_out_of_the_tail_stops_counting() {
    let (mut detector, now) = detector(&["PROMPT-MARKER"], &[]);
    detector.observe(b"PROMPT-MARKER", now);
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
    let patterns = StatePatterns::compile(&["(unclosed".to_string()], &[]);
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
    assert_eq!(strip_ansi(b"line\r\nnext"), "line\nnext");
}

#[test]
fn spacing_drawn_with_cursor_moves_survives_stripping() {
    assert_eq!(strip_ansi(b"\x1b[2GDo\x1b[5Gyou\x1b[9Gtrust"), " Do you trust");
    assert_eq!(strip_ansi(b"uno\x1b[3Cdos"), "uno   dos");
    assert_eq!(strip_ansi(b"\x1b[1;1H>\x1b[1;3HYou\x1b[2;3Hare"), "\n> You\n  are");
}

#[test]
fn a_prompt_drawn_word_by_word_still_blocks() {
    let (mut waiting, now) = detector(&["Do you trust"], &[]);
    waiting.observe(b"\x1b[3;3HDo\x1b[3;6Hyou\x1b[3;10Htrust\x1b[3;16Hthis", now);
    waiting.poll(now + Duration::from_millis(80));
    assert_eq!(waiting.state(), SessionState::Blocked);
}
