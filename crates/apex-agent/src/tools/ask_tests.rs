use super::*;

#[test]
fn a_question_with_choices_is_read_whole() {
    let asking = read(&json!({ "question": "cual?", "options": ["uno", "dos"] })).expect("read");
    assert_eq!(asking.question, "cual?");
    assert_eq!(asking.options, vec!["uno".to_owned(), "dos".to_owned()]);
}

#[test]
fn a_question_with_nothing_to_pick_from_is_refused() {
    let why = read(&json!({ "question": "como se llama?" })).expect_err("no options");
    assert!(format!("{why:#}").contains("at least two options"));
}

#[test]
fn a_question_with_only_one_answer_is_refused() {
    assert!(read(&json!({ "question": "cual?", "options": ["uno"] })).is_err());
}

#[test]
fn blank_options_do_not_count_towards_the_two() {
    assert!(read(&json!({ "question": "cual?", "options": ["uno", "  ", ""] })).is_err());
}

#[test]
fn the_options_are_taken_without_their_spaces() {
    let asking = read(&json!({ "question": "cual?", "options": [" uno ", "dos"] })).expect("read");
    assert_eq!(asking.options, vec!["uno".to_owned(), "dos".to_owned()]);
}

#[test]
fn a_call_with_no_question_is_refused() {
    assert!(read(&json!({ "options": ["uno", "dos"] })).is_err());
    assert!(read(&json!({ "question": "  ", "options": ["uno", "dos"] })).is_err());
}
