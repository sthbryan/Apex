use super::*;

fn ours() -> Vec<String> {
    vec!["read".to_owned(), "bash".to_owned()]
}

#[test]
fn what_a_server_offers_is_read_into_tools() {
    let listed = json!({ "tools": [
        { "name": "apex_note", "description": "leave a note", "inputSchema": { "type": "object" } }
    ] });
    let tools = readable(&listed, &ours());
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0].name, "apex_note");
    assert_eq!(tools[0].description, "leave a note");
}

#[test]
fn a_server_tool_never_takes_the_place_of_one_of_ours() {
    let listed = json!({ "tools": [
        { "name": "read", "description": "a different read" },
        { "name": "apex_note", "description": "leave a note" }
    ] });
    let names: Vec<String> = readable(&listed, &ours()).into_iter().map(|one| one.name).collect();
    assert_eq!(names, vec!["apex_note"]);
}

#[test]
fn a_tool_with_no_schema_still_gets_one_it_can_be_called_with() {
    let listed = json!({ "tools": [{ "name": "apex_note" }] });
    let tools = readable(&listed, &ours());
    assert_eq!(tools[0].parameters["type"], "object");
    assert_eq!(tools[0].description, "");
}

#[test]
fn a_listing_that_makes_no_sense_offers_nothing() {
    assert!(readable(&json!({}), &ours()).is_empty());
    assert!(readable(&json!({ "tools": "lots" }), &ours()).is_empty());
    assert!(readable(&json!({ "tools": [{ "description": "no name" }] }), &ours()).is_empty());
}

#[test]
fn what_a_tool_said_comes_back_as_text() {
    let answer = json!({ "content": [{ "type": "text", "text": "hecho" }] });
    assert_eq!(told(&answer).expect("told"), "hecho");
}

#[test]
fn several_blocks_are_joined_into_one_answer() {
    let answer = json!({ "content": [
        { "type": "text", "text": "uno" },
        { "type": "text", "text": "dos" }
    ] });
    assert_eq!(told(&answer).expect("told"), "uno\ndos");
}

#[test]
fn a_tool_that_failed_comes_back_as_a_failure_and_not_as_text() {
    let answer = json!({ "isError": true, "content": [{ "type": "text", "text": "no existe" }] });
    let why = told(&answer).expect_err("failed");
    assert!(format!("{why:#}").contains("no existe"));
}

#[test]
fn a_failure_with_nothing_to_say_still_reads_as_a_failure() {
    assert!(told(&json!({ "isError": true, "content": [] })).is_err());
}

#[test]
fn a_tool_that_said_nothing_says_so_instead_of_coming_back_blank() {
    assert_eq!(told(&json!({ "content": [] })).expect("told"), "the tool said nothing");
    assert_eq!(told(&json!({})).expect("told"), "the tool said nothing");
}

#[test]
fn blocks_that_are_not_text_are_left_out_rather_than_guessed_at() {
    let answer = json!({ "content": [
        { "type": "image", "data": "..." },
        { "type": "text", "text": "hecho" }
    ] });
    assert_eq!(told(&answer).expect("told"), "hecho");
}

#[test]
fn a_stdio_server_is_read_out_of_what_the_client_offered() {
    let wanted: Wanted = serde_json::from_value(json!({
        "type": "stdio",
        "name": "apex",
        "command": "/opt/apex/apexd",
        "args": ["mcp", "--session", "abc"],
        "env": []
    }))
    .expect("wanted");
    assert!(matches!(wanted, Wanted::Stdio { .. }));
}

#[test]
fn a_server_with_nothing_plugged_in_offers_nothing() {
    let servers = Servers::default();
    assert!(servers.is_empty());
    assert!(servers.offered().is_empty());
    assert!(!servers.holds("apex_note"));
}
