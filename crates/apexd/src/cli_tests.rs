use apex_proto::{DaemonReport, IDLE_GRACE_NEVER, PROTOCOL_VERSION};

use std::path::{Path, PathBuf};

use crate::cli::{Ask, Auth, Verb, app_traces, bundle_of, data_traces, read, spell, spell_report};

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

#[test]
fn all_and_keep_settings_pick_the_two_ends() {
    let Some(Verb::Uninstall { settings, .. }) =
        read(argv(&["apex", "uninstall", "--all"]).into_iter())
    else {
        panic!("expected an uninstall verb");
    };
    assert_eq!(settings, Ask::Yes);

    let Some(Verb::Uninstall { settings, .. }) =
        read(argv(&["apex", "uninstall", "--keep-settings"]).into_iter())
    else {
        panic!("expected an uninstall verb");
    };
    assert_eq!(settings, Ask::No);
}

#[test]
fn uninstall_asks_when_it_was_told_nothing_or_told_both() {
    for words in [vec!["apex", "uninstall"], vec!["apex", "uninstall", "--all", "--keep-settings"]]
    {
        let Some(Verb::Uninstall { settings, confirmed }) = read(argv(&words).into_iter()) else {
            panic!("expected an uninstall verb");
        };
        assert_eq!(settings, Ask::Prompt);
        assert!(!confirmed);
    }
}

#[test]
fn yes_skips_the_last_word_but_not_the_settings_question() {
    let Some(Verb::Uninstall { settings, confirmed }) =
        read(argv(&["apex", "uninstall", "--yes"]).into_iter())
    else {
        panic!("expected an uninstall verb");
    };
    assert!(confirmed);
    assert_eq!(settings, Ask::Prompt);
}

#[test]
fn a_mac_bundle_is_found_above_the_binary() {
    let inside = Path::new("/Applications/Apex.app/Contents/Resources/apexd");

    assert_eq!(bundle_of(inside, None), Some(PathBuf::from("/Applications/Apex.app")));
}

#[test]
fn an_appimage_wins_over_whatever_is_above_the_binary() {
    let inside = Path::new("/tmp/.mount_abc/usr/bin/apexd");
    let image = PathBuf::from("/home/someone/.local/bin/apex-desktop");

    assert_eq!(bundle_of(inside, Some(image.clone())), Some(image));
}

#[test]
fn a_plain_build_belongs_to_no_bundle() {
    assert_eq!(bundle_of(Path::new("/repo/target/debug/apexd"), None), None);
}

#[test]
fn the_app_traces_are_only_what_we_actually_found() {
    let bundle = PathBuf::from("/Applications/Apex.app");
    let link = PathBuf::from("/home/someone/.local/bin/apex");

    assert_eq!(app_traces(Some(&bundle), Some(&link)), vec![bundle.clone(), link.clone()]);
    assert_eq!(app_traces(Some(&bundle), None), vec![bundle]);
    assert!(app_traces(None, None).is_empty());
}

#[test]
fn the_data_traces_carry_the_config_folder_and_the_webview_store() {
    let home = PathBuf::from("/home/someone");
    let config = home.join(".apex");

    let found = data_traces(&home, &config);

    assert!(found.contains(&config));
    assert!(found.contains(&home.join("Library/WebKit/com.justcallmebryan.apex")));
    assert!(found.contains(&home.join(".config/com.justcallmebryan.apex")));
}

fn auth(words: &[&str]) -> Auth {
    let mut all = vec!["/usr/local/bin/apex", "auth"];
    all.extend_from_slice(words);
    match read(argv(&all).into_iter()) {
        Some(Verb::Auth(auth)) => auth,
        _ => panic!("that was not an auth verb"),
    }
}

#[test]
fn a_bare_auth_lists_what_is_held() {
    assert_eq!(auth(&[]), Auth::List);
    assert_eq!(auth(&["list"]), Auth::List);
}

#[test]
fn auth_add_takes_the_provider_after_it() {
    assert_eq!(auth(&["add", "openai"]), Auth::Add("openai".to_owned()));
}

#[test]
fn auth_forgets_a_key_under_either_word() {
    assert_eq!(auth(&["rm", "openai"]), Auth::Remove("openai".to_owned()));
    assert_eq!(auth(&["remove", "openai"]), Auth::Remove("openai".to_owned()));
}

#[test]
fn auth_models_takes_the_provider_after_it() {
    assert_eq!(auth(&["models", "groq"]), Auth::Models("groq".to_owned()));
}

#[test]
fn auth_without_a_provider_says_which_one_is_missing() {
    assert_eq!(auth(&["add"]), Auth::Wrong("auth add needs a provider".to_owned()));
    assert_eq!(auth(&["rm"]), Auth::Wrong("auth rm needs a provider".to_owned()));
    assert_eq!(auth(&["models"]), Auth::Wrong("auth models needs a provider".to_owned()));
}

#[test]
fn a_blank_provider_name_counts_as_none_at_all() {
    assert_eq!(auth(&["add", "   "]), Auth::Wrong("auth add needs a provider".to_owned()));
}

#[test]
fn an_auth_word_nobody_knows_is_refused_by_name() {
    assert_eq!(auth(&["sniff"]), Auth::Wrong("there is no auth sniff".to_owned()));
}

#[test]
fn a_provider_name_is_taken_without_its_spaces() {
    assert_eq!(auth(&["add", " openai "]), Auth::Add("openai".to_owned()));
}
