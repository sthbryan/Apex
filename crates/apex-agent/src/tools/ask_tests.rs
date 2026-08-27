use super::*;

fn one(question: &str, options: Value) -> Value {
    json!({ "questions": [{ "question": question, "options": options }] })
}

fn plain(labels: &[&str]) -> Value {
    Value::Array(labels.iter().map(|label| json!({ "label": label })).collect())
}

#[test]
fn a_question_with_choices_is_read_whole() {
    let asking = read(&one("cual?", plain(&["uno", "dos"]))).expect("read");
    assert_eq!(asking.questions.len(), 1);
    assert_eq!(asking.questions[0].question, "cual?");
    assert_eq!(
        asking.questions[0].options,
        vec![
            Choice { label: "uno".to_owned(), description: None },
            Choice { label: "dos".to_owned(), description: None },
        ]
    );
}

#[test]
fn an_option_can_carry_a_line_saying_what_it_means() {
    let asking = read(&one(
        "cual?",
        json!([
            { "label": "uno", "description": " el primero " },
            { "label": "dos", "description": "   " },
        ]),
    ))
    .expect("read");
    assert_eq!(asking.questions[0].options[0].description.as_deref(), Some("el primero"));
    assert_eq!(asking.questions[0].options[1].description, None);
}

#[test]
fn several_questions_ride_in_one_call() {
    let asking = read(&json!({
        "questions": [
            { "question": "cual?", "options": plain(&["uno", "dos"]) },
            { "question": "y despues?", "options": plain(&["tres", "cuatro"]) },
        ]
    }))
    .expect("read");
    assert_eq!(asking.questions.len(), 2);
    assert_eq!(asking.questions[1].question, "y despues?");
}

#[test]
fn a_call_with_no_questions_at_all_is_refused() {
    assert!(read(&json!({ "questions": [] })).is_err());
    assert!(read(&json!({})).is_err());
}

#[test]
fn a_question_with_nothing_to_pick_from_is_refused() {
    let why =
        read(&json!({ "questions": [{ "question": "como se llama?" }] })).expect_err("no options");
    assert!(format!("{why:#}").contains("at least two options"));
}

#[test]
fn a_question_with_only_one_answer_is_refused() {
    assert!(read(&one("cual?", plain(&["uno"]))).is_err());
}

#[test]
fn blank_options_do_not_count_towards_the_two() {
    assert!(read(&one("cual?", plain(&["uno", "  ", ""]))).is_err());
}

#[test]
fn one_bad_question_spoils_the_whole_call() {
    assert!(
        read(&json!({
            "questions": [
                { "question": "cual?", "options": plain(&["uno", "dos"]) },
                { "question": "y?", "options": plain(&["solo"]) },
            ]
        }))
        .is_err()
    );
}

#[test]
fn the_options_are_taken_without_their_spaces() {
    let asking = read(&one("cual?", plain(&[" uno ", "dos"]))).expect("read");
    assert_eq!(asking.questions[0].options[0].label, "uno");
}

#[test]
fn a_call_with_no_question_is_refused() {
    assert!(read(&json!({ "questions": [{ "options": plain(&["uno", "dos"]) }] })).is_err());
    assert!(read(&one("  ", plain(&["uno", "dos"]))).is_err());
}

#[test]
fn one_answer_goes_back_plain_and_many_go_back_labelled() {
    let asking = read(&json!({
        "questions": [
            { "question": "cual?", "options": plain(&["uno", "dos"]) },
            { "question": "y despues?", "options": plain(&["tres", "cuatro"]) },
        ]
    }))
    .expect("read");

    assert_eq!(spell(&asking.questions[..1], &[Some("uno".to_owned())]), "uno");
    assert_eq!(
        spell(&asking.questions, &[Some("uno".to_owned()), None]),
        "cual?: uno\ny despues?: no answer"
    );
}
