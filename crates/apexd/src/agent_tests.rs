use std::path::Path;

use super::*;

fn asked(provider: Option<&str>, model: Option<&str>) -> Run {
    Run {
        provider: provider.map(str::to_owned),
        model: model.map(str::to_owned),
        mode: None,
        resume: None,
        list: false,
        acp: false,
        wrong: None,
    }
}

fn last(provider: &str, model: &str) -> Choice {
    Choice { provider: provider.to_owned(), model: model.to_owned() }
}

#[test]
fn what_you_type_is_what_you_get() {
    let picked = pick(&asked(Some("groq"), Some("kimi-k2")), None).expect("picked");
    assert_eq!(picked, last("groq", "kimi-k2"));
}

#[test]
fn with_nothing_typed_and_nothing_remembered_it_asks_for_a_provider() {
    let complaint = pick(&asked(None, None), None).expect_err("no provider");
    assert!(complaint.contains("needs a provider"));
}

#[test]
fn with_nothing_typed_it_takes_what_you_used_last() {
    let picked = pick(&asked(None, None), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5"));
}

#[test]
fn naming_only_the_provider_keeps_the_model_you_used_on_it() {
    let picked =
        pick(&asked(Some("openai"), None), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5"));
}

#[test]
fn changing_provider_does_not_carry_the_other_ones_model_over() {
    let complaint =
        pick(&asked(Some("groq"), None), Some(&last("openai", "gpt-5"))).expect_err("no model");
    assert!(complaint.contains("groq needs a model"));
    assert!(complaint.contains("apex auth models groq"));
}

#[test]
fn naming_only_the_model_keeps_the_provider_you_used_last() {
    let picked =
        pick(&asked(None, Some("gpt-5-mini")), Some(&last("openai", "gpt-5"))).expect("picked");
    assert_eq!(picked, last("openai", "gpt-5-mini"));
}

#[test]
fn a_provider_with_no_model_anywhere_says_where_to_look() {
    let complaint = pick(&asked(Some("openai"), None), None).expect_err("no model");
    assert!(complaint.contains("openai needs a model"));
}

#[test]
fn a_failure_is_shown_by_its_first_line_only() {
    assert_eq!(first_line("no such file\nbacktrace here"), "no such file");
    assert_eq!(first_line("one line"), "one line");
    assert_eq!(first_line(""), "");
}

fn options() -> Vec<String> {
    vec!["uno".to_owned(), "dos".to_owned(), "tres".to_owned()]
}

#[test]
fn a_number_picks_the_option_at_that_place() {
    assert_eq!(chosen("2", &options()), Some("dos".to_owned()));
    assert_eq!(chosen(" 1 ", &options()), Some("uno".to_owned()));
}

#[test]
fn a_number_nobody_offered_picks_nothing() {
    assert_eq!(chosen("0", &options()), None);
    assert_eq!(chosen("9", &options()), None);
}

#[test]
fn words_are_taken_as_the_answer_and_not_as_a_number() {
    assert_eq!(chosen("dos", &options()), None);
    assert_eq!(chosen("", &options()), None);
}

#[test]
fn an_open_question_has_no_options_to_pick_from() {
    assert_eq!(chosen("1", &[]), None);
}

fn kept(id: &str, cwd: &str, turns: usize, title: &str) -> Kept {
    Kept {
        head: Head {
            id: id.to_owned(),
            provider: "openai".to_owned(),
            model: "gpt-5".to_owned(),
            cwd: cwd.to_owned(),
            at: 0,
        },
        title: title.to_owned(),
        turns,
    }
}

#[test]
fn asking_for_a_conversation_by_name_finds_it() {
    let all = vec![kept("one", "/here", 1, "uno"), kept("two", "/there", 1, "dos")];
    let found = wanted(&all, Some("two"), Path::new("/here")).expect("found");
    assert_eq!(found.head.id, "two");
}

#[test]
fn asking_for_a_name_nobody_has_finds_nothing() {
    let all = vec![kept("one", "/here", 1, "uno")];
    assert!(wanted(&all, Some("nope"), Path::new("/here")).is_none());
}

#[test]
fn asking_for_no_name_takes_the_newest_one_in_this_folder() {
    let all = vec![
        kept("newest-elsewhere", "/there", 1, "dos"),
        kept("newest-here", "/here", 1, "uno"),
        kept("older-here", "/here", 1, "cero"),
    ];
    let found = wanted(&all, None, Path::new("/here")).expect("found");
    assert_eq!(found.head.id, "newest-here");
}

#[test]
fn a_folder_with_nothing_said_in_it_finds_nothing() {
    let all = vec![kept("one", "/there", 1, "uno")];
    assert!(wanted(&all, None, Path::new("/here")).is_none());
}

#[test]
fn a_listing_lines_up_and_counts_the_turns() {
    let all = vec![kept("one", "/here", 1, "uno"), kept("longer-id", "/here", 3, "dos")];
    let spelled = spell_sessions(&all, Path::new("/here"));
    assert_eq!(spelled, "one          1 turn  uno\nlonger-id   3 turns  dos\n");
}

#[test]
fn a_conversation_from_another_folder_says_which_one() {
    let all = vec![kept("one", "/there", 2, "uno")];
    let spelled = spell_sessions(&all, Path::new("/here"));
    assert!(spelled.contains("(/there)"));
}

#[test]
fn a_conversation_from_this_folder_does_not_repeat_the_folder() {
    let all = vec![kept("one", "/here", 2, "uno")];
    assert!(!spell_sessions(&all, Path::new("/here")).contains("/here)"));
}

#[test]
fn nothing_kept_spells_nothing() {
    assert_eq!(spell_sessions(&[], Path::new("/here")), "");
}

#[test]
fn one_turn_is_not_called_turns() {
    assert_eq!(spell_turns(1), "1 turn");
    assert_eq!(spell_turns(0), "0 turns");
    assert_eq!(spell_turns(4), "4 turns");
}

#[test]
fn one_message_is_not_called_messages() {
    assert_eq!(spell_messages(1), "1 message");
    assert_eq!(spell_messages(6), "6 messages");
}

#[test]
fn a_window_past_the_line_counts_as_crowded() {
    assert!(crowded(Some(50), Some(50)));
    assert!(crowded(Some(90), Some(50)));
}

#[test]
fn a_window_short_of_the_line_is_not_crowded() {
    assert!(!crowded(Some(49), Some(50)));
    assert!(!crowded(Some(0), Some(50)));
}

#[test]
fn with_the_warning_turned_off_nothing_is_ever_crowded() {
    assert!(!crowded(Some(99), None));
}

#[test]
fn with_no_window_known_nothing_is_ever_crowded() {
    assert!(!crowded(None, Some(50)));
    assert!(!crowded(None, None));
}

#[test]
fn the_running_total_says_how_full_the_window_is_when_it_knows() {
    let spent = Spent { sent: 100, back: 20 };
    assert_eq!(spell_spent(spent, Some(40)), "120 tokens so far, window 40% full");
}

#[test]
fn the_running_total_stays_quiet_about_a_window_it_does_not_know() {
    let spent = Spent { sent: 100, back: 20 };
    assert_eq!(spell_spent(spent, None), "120 tokens so far");
}

#[test]
fn summing_up_says_how_much_is_left() {
    assert_eq!(spell_summed(240), "summed up in 240 characters, the window is clear again");
}

#[test]
fn the_protocol_is_asked_for_by_a_flag_of_its_own() {
    assert!(!Run::default().acp);
}
