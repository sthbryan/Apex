use super::*;

fn head(id: &str, at: i64) -> Head {
    Head {
        id: id.to_owned(),
        provider: "openai".to_owned(),
        model: "gpt-5".to_owned(),
        cwd: "/here".to_owned(),
        at,
    }
}

#[test]
fn a_conversation_comes_back_the_way_it_was_written() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("hola"));
    log.wrote(&Message::assistant("buenas"));

    let (back, messages) = open(dir.path(), "one").expect("open");
    assert_eq!(back, head("one", 10));
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0], Message::user("hola"));
}

#[test]
fn a_session_nobody_started_is_not_there() {
    let dir = tempfile::tempdir().expect("dir");
    assert!(open(dir.path(), "missing").is_err());
}

#[test]
fn a_file_with_no_beginning_is_refused() {
    assert!(read("{\"kind\":\"turn\",\"message\":{\"role\":\"user\",\"content\":[]}}").is_err());
}

#[test]
fn a_broken_line_is_skipped_instead_of_losing_the_rest() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("hola"));
    let path = dir.path().join("one.jsonl");
    let mut raw = std::fs::read_to_string(&path).expect("read");
    raw.push_str("this is not json\n");
    std::fs::write(&path, raw).expect("write");

    let (_, messages) = open(dir.path(), "one").expect("open");
    assert_eq!(messages.len(), 1);
}

#[test]
fn the_folder_is_made_when_it_is_not_there_yet() {
    let dir = tempfile::tempdir().expect("dir");
    let nested = dir.path().join("agent");
    Log::start(&nested, &head("one", 10)).expect("start");
    assert!(nested.join("one.jsonl").exists());
}

#[test]
fn a_conversation_is_titled_by_the_first_thing_asked() {
    let messages = vec![Message::assistant("hola"), Message::user("arregla el login")];
    assert_eq!(title(&messages), "arregla el login");
}

#[test]
fn a_long_first_line_is_cut_for_the_title() {
    let long = "x".repeat(200);
    let titled = title(&[Message::user(long)]);
    assert_eq!(titled.chars().count(), 61);
    assert!(titled.ends_with('…'));
}

#[test]
fn only_the_first_line_becomes_the_title() {
    assert_eq!(title(&[Message::user("uno\ndos\ntres")]), "uno");
}

#[test]
fn a_title_skips_the_blank_lines_at_the_top() {
    assert_eq!(title(&[Message::user("\n\n  arregla esto")]), "arregla esto");
}

#[test]
fn a_conversation_with_nothing_said_says_so() {
    assert_eq!(title(&[]), "nothing was said");
    assert_eq!(title(&[Message::assistant("hola")]), "nothing was said");
}

#[test]
fn the_sessions_are_listed_newest_first() {
    let dir = tempfile::tempdir().expect("dir");
    Log::start(dir.path(), &head("older", 10)).expect("start").wrote(&Message::user("uno"));
    Log::start(dir.path(), &head("newer", 20)).expect("start").wrote(&Message::user("dos"));

    let listed = list(dir.path());
    assert_eq!(listed.len(), 2);
    assert_eq!(listed[0].head.id, "newer");
    assert_eq!(listed[0].title, "dos");
}

#[test]
fn a_listing_counts_the_turns_and_not_the_answers() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("uno"));
    log.wrote(&Message::assistant("respuesta"));
    log.wrote(&Message::user("dos"));

    assert_eq!(list(dir.path())[0].turns, 2);
}

#[test]
fn a_folder_with_no_sessions_lists_nothing() {
    let dir = tempfile::tempdir().expect("dir");
    assert!(list(dir.path()).is_empty());
    assert!(list(Path::new("/nowhere/at/all")).is_empty());
}

#[test]
fn files_that_are_not_conversations_are_left_out_of_the_listing() {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::write(dir.path().join("preamble.md"), "be brief").expect("write");
    std::fs::write(dir.path().join("last.toml"), "provider = \"openai\"").expect("write");
    assert!(list(dir.path()).is_empty());
}

#[test]
fn every_session_gets_a_name_of_its_own() {
    let now = chrono::Local::now();
    let one = newest_id(now);
    let other = newest_id(now);
    assert_ne!(one, other);
    assert!(one.starts_with(&now.format("%Y%m%d-").to_string()));
}

#[test]
fn a_summary_replaces_everything_that_came_before_it() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("uno"));
    log.wrote(&Message::assistant("respuesta"));
    log.compacted("hablamos de uno");
    log.wrote(&Message::user("dos"));

    let (_, messages) = open(dir.path(), "one").expect("open");
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[1], Message::user("dos"));
}

#[test]
fn the_summary_comes_back_marked_as_what_came_before() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("uno"));
    log.compacted("hablamos de uno");

    let (_, messages) = open(dir.path(), "one").expect("open");
    assert_eq!(messages, vec![Message::user(wrapped("hablamos de uno"))]);
}

#[test]
fn nothing_is_lost_from_the_file_when_it_is_summed_up() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("uno"));
    log.compacted("hablamos de uno");

    let raw = std::fs::read_to_string(dir.path().join("one.jsonl")).expect("read");
    assert!(raw.contains("uno"));
    assert!(raw.contains("hablamos de uno"));
}

#[test]
fn a_summary_is_labelled_so_the_model_knows_what_it_is() {
    assert_eq!(wrapped("  hicimos esto  "), "Earlier in this conversation:\n\nhicimos esto");
}

#[test]
fn a_summed_up_conversation_is_still_titled_by_what_is_left() {
    let dir = tempfile::tempdir().expect("dir");
    let log = Log::start(dir.path(), &head("one", 10)).expect("start");
    log.wrote(&Message::user("lo viejo"));
    log.compacted("hablamos de lo viejo");

    assert!(list(dir.path())[0].title.starts_with("Earlier in this conversation"));
}
