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
fn the_last_message_is_the_one_being_answered() {
    let history = vec![Message::user("uno"), Message::user("dos")];
    let (prior, prompt) = split(&history);
    assert_eq!(prior.len(), 1);
    assert!(matches!(prompt, Message::User { .. }));
    assert_eq!(prior[0], history[0]);
    assert_eq!(prompt, history[1]);
}

#[test]
fn an_empty_history_still_hands_back_something_to_send() {
    let (prior, _) = split(&[]);
    assert!(prior.is_empty());
}

#[test]
fn the_tool_calls_are_picked_out_of_what_the_model_said() {
    let choice = vec![
        AssistantContent::text("voy a mirar"),
        AssistantContent::tool_call("call-1", "read", serde_json::json!({ "path": "a.rs" })),
    ];
    let calls = wanted(&choice);
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].name, "read");
    assert_eq!(calls[0].id, "call-1");
    assert_eq!(calls[0].args["path"], "a.rs");
}

#[test]
fn plain_words_ask_for_no_tools() {
    assert!(wanted(&[AssistantContent::text("listo")]).is_empty());
    assert!(wanted(&[]).is_empty());
}

#[test]
fn several_tool_calls_come_back_in_the_order_they_were_asked() {
    let choice = vec![
        AssistantContent::tool_call("one", "read", serde_json::json!({})),
        AssistantContent::tool_call("two", "find", serde_json::json!({})),
    ];
    let calls = wanted(&choice);
    assert_eq!(calls[0].id, "one");
    assert_eq!(calls[1].id, "two");
}

#[test]
fn a_tool_that_failed_goes_back_marked_as_failed() {
    assert_eq!(spell(&Done::Said("todo bien".to_owned())), "todo bien");
    assert_eq!(spell(&Done::Failed("no existe".to_owned())), "failed: no existe");
}
