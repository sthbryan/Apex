use super::*;

const EVERY_TOOL: &[&str] =
    &["read", "search", "find", "write", "edit", "bash", "fetch", "todo", "ask"];

#[test]
fn auto_holds_nothing_back() {
    for tool in EVERY_TOOL {
        assert!(Mode::Auto.allows(tool), "{tool}");
    }
}

#[test]
fn chat_reads_and_nothing_more() {
    assert!(Mode::Chat.allows("read"));
    assert!(Mode::Chat.allows("search"));
    assert!(Mode::Chat.allows("find"));
    assert!(Mode::Chat.allows("fetch"));
    assert!(!Mode::Chat.allows("write"));
    assert!(!Mode::Chat.allows("edit"));
    assert!(!Mode::Chat.allows("bash"));
}

#[test]
fn plan_reads_and_keeps_a_list() {
    assert!(Mode::Plan.allows("todo"));
    assert!(Mode::Plan.allows("read"));
    assert!(!Mode::Plan.allows("write"));
    assert!(!Mode::Plan.allows("bash"));
}

#[test]
fn chat_does_not_keep_a_list() {
    assert!(!Mode::Chat.allows("todo"));
}

#[test]
fn asking_the_person_is_open_in_every_mode() {
    assert!(Mode::Chat.allows("ask"));
    assert!(Mode::Plan.allows("ask"));
    assert!(Mode::Auto.allows("ask"));
}

#[test]
fn a_tool_nobody_wrote_yet_is_shut_out_of_the_quiet_modes() {
    assert!(!Mode::Chat.allows("launch-missiles"));
    assert!(!Mode::Plan.allows("launch-missiles"));
}

#[test]
fn the_modes_are_read_back_from_their_names() {
    assert_eq!(Mode::parse("chat"), Some(Mode::Chat));
    assert_eq!(Mode::parse("PLAN"), Some(Mode::Plan));
    assert_eq!(Mode::parse(" auto "), Some(Mode::Auto));
    assert_eq!(Mode::parse("yolo"), None);
    assert_eq!(Mode::parse(""), None);
}

#[test]
fn every_mode_spells_back_to_itself() {
    for mode in [Mode::Chat, Mode::Plan, Mode::Auto] {
        assert_eq!(Mode::parse(mode.as_str()), Some(mode));
    }
}

#[test]
fn yolo_is_what_you_get_when_you_say_nothing() {
    assert_eq!(Mode::default(), Mode::Auto);
}

#[test]
fn the_quiet_modes_tell_the_model_why_and_auto_says_nothing() {
    assert!(Mode::Chat.hint().contains("chat mode"));
    assert!(Mode::Plan.hint().contains("plan mode"));
    assert!(Mode::Auto.hint().is_empty());
}
