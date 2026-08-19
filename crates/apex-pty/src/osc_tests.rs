use super::*;

fn notice(title: Option<&str>, body: &str) -> TerminalNotice {
    TerminalNotice { title: title.map(str::to_string), body: body.to_string() }
}

#[test]
fn a_notify_sequence_carries_title_and_body() {
    let mut scanner = OscScanner::new(false);
    let found = scanner.scan(b"\x1b]777;notify;Claude;done here\x07", Instant::now());
    assert_eq!(found, vec![notice(Some("Claude"), "done here")]);
}

#[test]
fn the_short_sequence_only_carries_a_body() {
    let mut scanner = OscScanner::new(false);
    let found = scanner.scan(b"\x1b]9;waiting for you\x07", Instant::now());
    assert_eq!(found, vec![notice(None, "waiting for you")]);
}

#[test]
fn a_string_terminator_closes_the_sequence() {
    let mut scanner = OscScanner::new(false);
    let found = scanner.scan(b"\x1b]9;done\x1b\\", Instant::now());
    assert_eq!(found, vec![notice(None, "done")]);
}

#[test]
fn a_sequence_split_across_chunks_still_arrives() {
    let mut scanner = OscScanner::new(false);
    let now = Instant::now();
    assert!(scanner.scan(b"\x1b]777;notify;Codex;half", now).is_empty());
    assert_eq!(scanner.scan(b" and half\x07", now), vec![notice(Some("Codex"), "half and half")]);
}

#[test]
fn progress_reports_are_not_notices() {
    let mut scanner = OscScanner::new(false);
    assert!(scanner.scan(b"\x1b]9;4;1;50\x07", Instant::now()).is_empty());
}

#[test]
fn a_window_title_is_not_a_notice() {
    let mut scanner = OscScanner::new(false);
    assert!(scanner.scan(b"\x1b]0;~/code/apex\x07", Instant::now()).is_empty());
}

#[test]
fn an_empty_notice_is_dropped() {
    let mut scanner = OscScanner::new(false);
    assert!(scanner.scan(b"\x1b]9;   \x07", Instant::now()).is_empty());
}

#[test]
fn plain_output_never_looks_like_a_notice() {
    let mut scanner = OscScanner::new(false);
    assert!(scanner.scan(b"running tests\n\x1b[2Kdone\n", Instant::now()).is_empty());
}

#[test]
fn the_bell_is_ignored_unless_the_profile_wants_it() {
    let mut scanner = OscScanner::new(false);
    assert!(scanner.scan(b"\x07", Instant::now()).is_empty());
}

#[test]
fn the_bell_rings_once_and_then_rests() {
    let mut scanner = OscScanner::new(true);
    let now = Instant::now();
    assert_eq!(scanner.scan(b"\x07", now), vec![notice(None, "")]);
    assert!(scanner.scan(b"\x07", now + Duration::from_millis(500)).is_empty());
    assert_eq!(scanner.scan(b"\x07", now + Duration::from_secs(3)), vec![notice(None, "")]);
}

#[test]
fn the_bell_that_closes_a_sequence_is_not_a_ring() {
    let mut scanner = OscScanner::new(true);
    let found = scanner.scan(b"\x1b]9;ready\x07", Instant::now());
    assert_eq!(found, vec![notice(None, "ready")]);
}

#[test]
fn a_runaway_sequence_is_abandoned() {
    let mut scanner = OscScanner::new(false);
    let mut flood = b"\x1b]9;".to_vec();
    flood.extend(std::iter::repeat_n(b'x', MAX_SEQUENCE + 1));
    let now = Instant::now();
    assert!(scanner.scan(&flood, now).is_empty());
    assert_eq!(scanner.scan(b"\x1b]9;back\x07", now), vec![notice(None, "back")]);
}
