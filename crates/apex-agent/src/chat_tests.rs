use super::*;

fn usage(sent: u64, back: u64) -> Usage {
    Usage { input_tokens: sent, output_tokens: back, ..Usage::default() }
}

#[test]
fn what_a_turn_costs_piles_up_across_turns() {
    let mut spent = Spent::default();
    spent.add(&usage(100, 20));
    spent.add(&usage(140, 35));
    assert_eq!(spent, Spent { sent: 240, back: 55 });
    assert_eq!(spent.total(), 295);
}

#[test]
fn a_turn_that_reports_nothing_costs_nothing() {
    let mut spent = Spent::default();
    spent.add(&usage(0, 0));
    assert_eq!(spent, Spent::default());
}

#[test]
fn a_turn_keeps_both_sides_of_it() {
    let mut history = Vec::new();
    remember(&mut history, Message::user("hola"), vec![AssistantContent::text("buenas")]);
    assert_eq!(history.len(), 2);
    assert!(matches!(history[0], Message::User { .. }));
    assert!(matches!(history[1], Message::Assistant { .. }));
}

#[test]
fn a_turn_the_model_never_answered_keeps_only_the_question() {
    let mut history = Vec::new();
    remember(&mut history, Message::user("hola"), Vec::new());
    assert_eq!(history.len(), 1);
    assert!(matches!(history[0], Message::User { .. }));
}

#[test]
fn an_answer_of_only_whitespace_counts_as_no_answer() {
    assert!(said_nothing(&[AssistantContent::text("   \n")]));
    assert!(said_nothing(&[]));
    assert!(!said_nothing(&[AssistantContent::text("buenas")]));
}

#[test]
fn a_tool_call_counts_as_an_answer_even_with_no_words() {
    let called = AssistantContent::tool_call("call-1", "read", serde_json::json!({}));
    assert!(!said_nothing(&[called]));
}

#[test]
fn turns_pile_up_in_the_order_they_happened() {
    let mut history = Vec::new();
    remember(&mut history, Message::user("uno"), vec![AssistantContent::text("primero")]);
    remember(&mut history, Message::user("dos"), vec![AssistantContent::text("segundo")]);
    assert_eq!(history.len(), 4);
    assert!(matches!(history[2], Message::User { .. }));
}
