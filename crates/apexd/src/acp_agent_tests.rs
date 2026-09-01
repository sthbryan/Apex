use super::*;

#[test]
fn the_words_of_a_prompt_come_out_of_its_blocks() {
    let prompt = json!([
        { "type": "text", "text": "arregla" },
        { "type": "text", "text": "el login" }
    ]);
    assert_eq!(spoken(Some(&prompt)), "arregla\nel login");
}

#[test]
fn a_prompt_with_nothing_readable_comes_out_empty() {
    assert_eq!(spoken(None), "");
    assert_eq!(spoken(Some(&json!([]))), "");
    assert_eq!(spoken(Some(&json!("not a list"))), "");
    assert_eq!(spoken(Some(&json!([{ "type": "image", "mimeType": "image/png" }]))), "");
}

#[test]
fn every_tool_is_labelled_with_a_kind_the_protocol_knows() {
    assert_eq!(kind_of("read"), "read");
    assert_eq!(kind_of("search"), "read");
    assert_eq!(kind_of("write"), "edit");
    assert_eq!(kind_of("edit"), "edit");
    assert_eq!(kind_of("bash"), "execute");
    assert_eq!(kind_of("fetch"), "fetch");
    assert_eq!(kind_of("todo"), "think");
    assert_eq!(kind_of("ask"), "other");
}

#[test]
fn a_tool_nobody_wrote_yet_is_labelled_other_and_not_guessed() {
    assert_eq!(kind_of("juggle"), "other");
}

#[test]
fn a_tool_call_is_titled_by_what_it_is_doing() {
    let call =
        Call { id: "1".to_owned(), name: "read".to_owned(), args: json!({ "path": "src/one.rs" }) };
    assert_eq!(spell_call(&call), "read src/one.rs");
}

#[test]
fn a_tool_call_with_nothing_to_show_is_titled_by_its_name_alone() {
    let call = Call { id: "1".to_owned(), name: "todo".to_owned(), args: json!({}) };
    assert_eq!(spell_call(&call), "todo");
}

#[test]
fn a_chosen_option_comes_back_by_its_id() {
    let answer = json!({ "outcome": { "outcome": "selected", "optionId": "dos" } });
    assert_eq!(chose(&answer), Some("dos".to_owned()));
}

#[test]
fn a_cancelled_question_comes_back_as_no_answer() {
    assert_eq!(chose(&json!({ "outcome": { "outcome": "cancelled" } })), None);
}

#[test]
fn an_answer_that_makes_no_sense_comes_back_as_no_answer() {
    assert_eq!(chose(&json!({})), None);
    assert_eq!(chose(&json!({ "outcome": {} })), None);
    assert_eq!(chose(&json!({ "outcome": { "outcome": "selected" } })), None);
}

#[test]
fn questions_use_valid_permission_options_and_keep_their_metadata() {
    let question = apex_agent::tools::ask::Question {
        question: "Which one?".to_owned(),
        options: vec![apex_agent::tools::ask::Choice {
            label: "first".to_owned(),
            description: Some("the first choice".to_owned()),
        }],
    };
    let request = question_permission("session", "call-1", &question, 1, 3);

    assert_eq!(request["options"][0]["kind"], "allow_once");
    assert_eq!(request["_meta"]["apexQuestion"], true);
    assert_eq!(request["_meta"]["apexGroup"]["at"], 1);
}

#[test]
fn the_configured_model_is_offered_when_its_provider_lists_nothing() {
    let listed = ensure_model(Vec::new(), "qwen3:8b");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, "qwen3:8b");
}

#[test]
fn the_servers_the_client_offers_are_read_out_of_the_call() {
    let offered = json!([
        { "type": "stdio", "name": "apex", "command": "/opt/apex/apexd", "args": ["mcp"], "env": [] }
    ]);
    let plugged = plugged(Some(&offered));
    assert_eq!(plugged.len(), 1);
}

#[test]
fn a_client_that_offers_nothing_plugs_in_nothing() {
    assert!(plugged(None).is_empty());
    assert!(plugged(Some(&json!([]))).is_empty());
}

#[test]
fn a_server_we_cannot_read_is_skipped_and_the_rest_still_plug_in() {
    let offered = json!([
        { "type": "smoke-signals", "name": "odd" },
        { "type": "stdio", "name": "apex", "command": "/opt/apex/apexd" }
    ]);
    assert_eq!(plugged(Some(&offered)).len(), 1);
}
