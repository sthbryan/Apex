use super::*;

#[test]
fn a_question_with_choices_is_read_whole() {
    let asking = read(&json!({ "question": "cual?", "options": ["uno", "dos"] })).expect("read");
    assert_eq!(asking.question, "cual?");
    assert_eq!(asking.options, vec!["uno".to_owned(), "dos".to_owned()]);
}

#[test]
fn an_open_question_needs_no_choices() {
    let asking = read(&json!({ "question": "como se llama?" })).expect("read");
    assert!(asking.options.is_empty());
}

#[test]
fn a_call_with_no_question_is_refused() {
    assert!(read(&json!({ "options": ["uno"] })).is_err());
}
