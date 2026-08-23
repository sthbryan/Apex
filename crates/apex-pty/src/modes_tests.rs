use super::*;

fn watched(chunks: &[&[u8]]) -> Vec<u8> {
    let mut watcher = ModeWatcher::default();
    for chunk in chunks {
        watcher.watch(chunk);
    }
    watcher.prelude()
}

#[test]
fn a_quiet_stream_asks_for_nothing() {
    assert!(watched(&[b"hello world"]).is_empty());
}

#[test]
fn the_alt_screen_comes_back_first() {
    let prelude = watched(&[b"\x1b[?1006h\x1b[?1049h"]);
    assert!(prelude.starts_with(b"\x1b[?1049h"));
    assert!(prelude.ends_with(b"\x1b[?1006h"));
}

#[test]
fn mouse_tracking_survives_a_split_sequence() {
    assert_eq!(watched(&[b"\x1b[?10", b"03h"]), b"\x1b[?1003h".to_vec());
}

#[test]
fn a_reset_drops_the_mode_again() {
    assert!(watched(&[b"\x1b[?1000h", b"\x1b[?1000l"]).is_empty());
}

#[test]
fn several_modes_in_one_sequence_all_count() {
    let prelude = watched(&[b"\x1b[?1000;1002;1006h"]);
    assert_eq!(prelude, b"\x1b[?1000h\x1b[?1002h\x1b[?1006h".to_vec());
}

#[test]
fn a_hidden_cursor_stays_hidden() {
    assert_eq!(watched(&[b"\x1b[?25l"]), b"\x1b[?25l".to_vec());
}

#[test]
fn modes_we_do_not_track_are_left_alone() {
    assert!(watched(&[b"\x1b[?2026h"]).is_empty());
}
