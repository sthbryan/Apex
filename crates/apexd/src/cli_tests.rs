use apex_proto::{DaemonReport, IDLE_GRACE_NEVER, PROTOCOL_VERSION};

use crate::cli::{Verb, read, spell, spell_report};

fn argv(words: &[&str]) -> Vec<String> {
    words.iter().map(|word| word.to_string()).collect()
}

fn report() -> DaemonReport {
    DaemonReport {
        daemon_version: "0.8.0".into(),
        protocol_version: PROTOCOL_VERSION,
        uptime: 90,
        idle_grace: 300,
        idle_for: None,
        remaining: None,
        clients: 1,
        sessions: 3,
        live: 2,
    }
}

#[test]
fn a_bare_apexd_is_still_the_daemon() {
    assert!(read(argv(&["/usr/bin/apexd"]).into_iter()).is_none());
}

#[test]
fn the_daemon_verb_hands_back_to_the_daemon() {
    assert!(read(argv(&["/usr/local/bin/apex", "daemon"]).into_iter()).is_none());
}

#[test]
fn a_bare_apex_asks_for_help_instead_of_becoming_the_daemon() {
    assert!(matches!(read(argv(&["/usr/local/bin/apex"]).into_iter()), Some(Verb::Help)));
}

#[test]
fn apexd_answers_a_verb_even_when_it_is_not_called_apex() {
    assert!(matches!(read(argv(&["/usr/bin/apexd", "status"]).into_iter()), Some(Verb::Status)));
}

#[test]
fn a_word_nobody_knows_is_not_taken_for_the_daemon() {
    let Some(Verb::Unknown(word)) = read(argv(&["/usr/local/bin/apex", "wat"]).into_iter()) else {
        panic!("expected an unknown verb");
    };
    assert_eq!(word, "wat");
}

#[test]
fn notify_gathers_the_words_and_lifts_the_title_out() {
    let Some(Verb::Notify { title, body }) =
        read(argv(&["apex", "notify", "the", "build", "is", "done", "--title", "ci"]).into_iter())
    else {
        panic!("expected a notify verb");
    };
    assert_eq!(title.as_deref(), Some("ci"));
    assert_eq!(body, "the build is done");
}

#[test]
fn a_grace_that_never_ends_is_spelled_out() {
    let mut report = report();
    report.idle_grace = IDLE_GRACE_NEVER;

    assert!(spell_report(&report).contains("until you stop it"));
}

#[test]
fn a_countdown_shows_what_is_left_of_it() {
    let mut report = report();
    report.idle_for = Some(60);
    report.remaining = Some(240);

    assert!(spell_report(&report).contains("4m left"));
}

#[test]
fn a_grace_of_zero_says_it_goes_with_the_last_client() {
    let mut report = report();
    report.idle_grace = 0;

    assert!(spell_report(&report).contains("stops with the last client"));
}

#[test]
fn sessions_only_count_the_running_ones_apart() {
    let printed = spell_report(&report());

    assert!(printed.contains("3, 2 running"));
}

#[test]
fn every_session_running_is_printed_as_one_number() {
    let mut report = report();
    report.live = 3;

    assert!(spell_report(&report).contains("sessions   3\n"));
}

#[test]
fn durations_drop_the_units_that_are_empty() {
    assert_eq!(spell(45), "45s");
    assert_eq!(spell(60), "1m");
    assert_eq!(spell(90), "1m 30s");
    assert_eq!(spell(3600), "1h");
    assert_eq!(spell(8040), "2h 14m");
}
