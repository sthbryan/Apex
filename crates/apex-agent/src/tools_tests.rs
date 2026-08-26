use super::*;
use crate::mode as apex_agent_mode;

fn root() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("dir");
    std::fs::create_dir_all(dir.path().join("src")).expect("mkdir");
    std::fs::write(dir.path().join("src/one.rs"), "fn uno() {}\n").expect("write");
    dir
}

#[test]
fn a_relative_path_lands_inside_the_project() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert_eq!(within(&here, "src/one.rs").expect("within"), here.join("src/one.rs"));
}

#[test]
fn a_path_that_climbs_out_is_refused() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert!(within(&here, "../secrets").is_err());
    assert!(within(&here, "src/../../secrets").is_err());
}

#[test]
fn an_absolute_path_elsewhere_is_refused() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert!(within(&here, "/etc/passwd").is_err());
}

#[test]
fn an_absolute_path_inside_the_project_is_taken() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    let inside = here.join("src/one.rs");
    assert_eq!(within(&here, &inside.display().to_string()).expect("within"), inside);
}

#[test]
fn climbing_out_and_back_in_is_still_inside() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert_eq!(within(&here, "src/../src/one.rs").expect("within"), here.join("src/one.rs"));
}

#[test]
fn a_path_that_is_not_there_yet_is_still_allowed() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert_eq!(within(&here, "src/new.rs").expect("within"), here.join("src/new.rs"));
}

#[test]
fn an_empty_path_is_refused() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert!(within(&here, "").is_err());
    assert!(within(&here, "   ").is_err());
}

#[test]
fn a_path_is_shown_the_short_way() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert_eq!(shown(&here, &here.join("src/one.rs")), "src/one.rs");
}

#[test]
fn a_path_from_somewhere_else_is_shown_whole() {
    let dir = root();
    let here = dir.path().canonicalize().expect("real");
    assert_eq!(shown(&here, Path::new("/etc/hosts")), "/etc/hosts");
}

#[tokio::test]
async fn a_tool_nobody_wrote_comes_back_as_a_failure_not_a_crash() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let call = Call { id: "1".to_owned(), name: "juggle".to_owned(), args: serde_json::json!({}) };
    let done = kit.run(&call).await;
    assert!(!done.went_well());
    assert!(done.text().contains("juggle"));
}

#[tokio::test]
async fn a_tool_called_with_the_wrong_arguments_says_so_instead_of_failing_the_turn() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let call = Call { id: "1".to_owned(), name: "read".to_owned(), args: serde_json::json!({}) };
    let done = kit.run(&call).await;
    assert!(!done.went_well());
    assert!(done.text().contains("bad arguments"));
}

#[tokio::test]
async fn reading_a_file_outside_the_project_is_refused() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let call = Call {
        id: "1".to_owned(),
        name: "read".to_owned(),
        args: serde_json::json!({ "path": "../../etc/passwd" }),
    };
    let done = kit.run(&call).await;
    assert!(!done.went_well());
    assert!(done.text().contains("outside this project"));
}

#[tokio::test]
async fn reading_a_file_inside_the_project_works() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let call = Call {
        id: "1".to_owned(),
        name: "read".to_owned(),
        args: serde_json::json!({ "path": "src/one.rs" }),
    };
    let done = kit.run(&call).await;
    assert!(done.went_well());
    assert!(done.text().contains("fn uno"));
}

#[test]
fn the_kit_offers_the_tools_it_can_run() {
    let dir = root();
    let names: Vec<String> =
        Kit::new(dir.path()).offered().into_iter().map(|one| one.name).collect();
    assert_eq!(
        names,
        vec!["read", "search", "find", "write", "edit", "bash", "fetch", "todo", "ask"]
    );
}

#[test]
fn a_result_knows_whether_it_went_well() {
    assert!(Done::Said("ok".to_owned()).went_well());
    assert!(!Done::Failed("nope".to_owned()).went_well());
    assert_eq!(Done::Failed("nope".to_owned()).text(), "nope");
}

fn call(name: &str, args: Value) -> Call {
    Call { id: "1".to_owned(), name: name.to_owned(), args }
}

#[test]
fn a_call_is_sketched_by_the_field_that_matters() {
    assert_eq!(
        sketch(&call("read", serde_json::json!({ "path": "src/one.rs", "limit": 20 }))),
        "src/one.rs"
    );
    assert_eq!(
        sketch(&call("search", serde_json::json!({ "pattern": "fn uno", "path": "src" }))),
        "fn uno"
    );
    assert_eq!(sketch(&call("find", serde_json::json!({ "glob": "**/*.rs" }))), "**/*.rs");
}

#[test]
fn a_tool_nobody_sketched_falls_back_to_whatever_it_was_told() {
    assert_eq!(sketch(&call("later", serde_json::json!({ "thing": "a value" }))), "a value");
}

#[test]
fn a_call_with_nothing_to_show_is_sketched_as_nothing() {
    assert_eq!(sketch(&call("read", serde_json::json!({}))), "");
    assert_eq!(sketch(&call("read", serde_json::json!({ "limit": 4 }))), "");
    assert_eq!(sketch(&call("read", serde_json::json!("not an object"))), "");
}

#[test]
fn a_long_sketch_is_cut_so_it_stays_on_one_line() {
    let long = "x".repeat(200);
    let sketched = sketch(&call("read", serde_json::json!({ "path": long })));
    assert_eq!(sketched.chars().count(), 61);
    assert!(sketched.ends_with('…'));
}

#[test]
fn a_sketch_never_carries_a_second_line() {
    assert_eq!(sketch(&call("search", serde_json::json!({ "pattern": "uno\ndos" }))), "uno");
}

async fn ran(kit: &Kit, name: &str, args: Value) -> Done {
    kit.run(&Call { id: "1".to_owned(), name: name.to_owned(), args }).await
}

#[tokio::test]
async fn a_new_file_can_be_written_without_reading_it_first() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "src/new.rs", "content": "fn dos() {}\n" }))
            .await;
    assert!(done.went_well(), "{}", done.text());
    assert!(done.text().contains("wrote src/new.rs"));
    assert_eq!(
        std::fs::read_to_string(dir.path().join("src/new.rs")).expect("read"),
        "fn dos() {}\n"
    );
}

#[tokio::test]
async fn a_file_that_is_already_there_is_not_replaced_unread() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "src/one.rs", "content": "gone\n" })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("have not read it"));
    assert!(std::fs::read_to_string(dir.path().join("src/one.rs")).expect("read").contains("uno"));
}

#[tokio::test]
async fn reading_a_file_first_lets_you_replace_it() {
    let dir = root();
    let kit = Kit::new(dir.path());
    ran(&kit, "read", serde_json::json!({ "path": "src/one.rs" })).await;
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "src/one.rs", "content": "fn dos() {}\n" }))
            .await;
    assert!(done.went_well(), "{}", done.text());
    assert!(done.text().contains("replaced src/one.rs"));
}

#[tokio::test]
async fn a_file_that_was_never_read_is_not_edited() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "edit", serde_json::json!({ "path": "src/one.rs", "old": "uno", "new": "dos" }))
            .await;
    assert!(!done.went_well());
    assert!(done.text().contains("read it before you change it"));
}

#[tokio::test]
async fn a_file_that_was_read_can_be_edited() {
    let dir = root();
    let kit = Kit::new(dir.path());
    ran(&kit, "read", serde_json::json!({ "path": "src/one.rs" })).await;
    let done =
        ran(&kit, "edit", serde_json::json!({ "path": "src/one.rs", "old": "uno", "new": "dos" }))
            .await;
    assert!(done.went_well(), "{}", done.text());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("src/one.rs")).expect("read"),
        "fn dos() {}\n"
    );
}

#[tokio::test]
async fn a_file_you_just_wrote_counts_as_read() {
    let dir = root();
    let kit = Kit::new(dir.path());
    ran(&kit, "write", serde_json::json!({ "path": "src/new.rs", "content": "fn uno() {}\n" }))
        .await;
    let done =
        ran(&kit, "edit", serde_json::json!({ "path": "src/new.rs", "old": "uno", "new": "dos" }))
            .await;
    assert!(done.went_well(), "{}", done.text());
}

#[tokio::test]
async fn writing_outside_the_project_is_refused() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "../escaped.rs", "content": "x" })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("outside this project"));
}

#[tokio::test]
async fn a_written_file_makes_the_folders_it_needs() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "a/b/c.rs", "content": "x\n" })).await;
    assert!(done.went_well(), "{}", done.text());
    assert!(dir.path().join("a/b/c.rs").exists());
}

#[test]
fn a_file_is_only_seen_once_it_has_been_read() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let one = kit.root().join("src/one.rs");
    assert!(!kit.has_seen(&one));
    kit.saw(&one);
    assert!(kit.has_seen(&one));
}

#[tokio::test]
async fn a_command_runs_in_the_project_folder() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done = ran(&kit, "bash", serde_json::json!({ "command": "cat src/one.rs" })).await;
    assert!(done.went_well(), "{}", done.text());
    assert!(done.text().contains("fn uno"));
}

#[tokio::test]
async fn a_command_that_fails_still_comes_back_with_what_it_printed() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done = ran(&kit, "bash", serde_json::json!({ "command": "echo nope >&2; exit 3" })).await;
    assert!(done.went_well(), "{}", done.text());
    assert!(done.text().contains("exit 3"));
    assert!(done.text().contains("nope"));
}

#[tokio::test]
async fn a_command_that_hangs_is_given_up_on() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done =
        ran(&kit, "bash", serde_json::json!({ "command": "sleep 5", "timeout_seconds": 1 })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("gave up after 1 seconds"));
}

#[tokio::test]
async fn a_command_with_nothing_in_it_is_refused() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done = ran(&kit, "bash", serde_json::json!({ "command": "  " })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("needs a command"));
}

#[tokio::test]
async fn a_list_of_steps_is_kept_for_whoever_draws_it() {
    let dir = root();
    let kit = Kit::new(dir.path());
    assert!(kit.todo().is_empty());
    let done = ran(
        &kit,
        "todo",
        serde_json::json!({ "items": [
        { "content": "uno", "status": "completed" },
        { "content": "dos", "status": "in_progress" }
    ] }),
    )
    .await;
    assert!(done.went_well(), "{}", done.text());
    assert_eq!(kit.todo().len(), 2);
    assert_eq!(kit.todo()[1].content, "dos");
}

#[tokio::test]
async fn a_newer_list_replaces_the_older_one() {
    let dir = root();
    let kit = Kit::new(dir.path());
    ran(&kit, "todo", serde_json::json!({ "items": [{ "content": "uno", "status": "pending" }] }))
        .await;
    ran(&kit, "todo", serde_json::json!({ "items": [{ "content": "dos", "status": "pending" }] }))
        .await;
    assert_eq!(kit.todo().len(), 1);
    assert_eq!(kit.todo()[0].content, "dos");
}

#[tokio::test]
async fn the_kit_refuses_to_answer_a_question_meant_for_a_person() {
    let dir = root();
    let kit = Kit::new(dir.path());
    let done = ran(&kit, "ask", serde_json::json!({ "question": "cual?" })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("answered by the person"));
}

#[test]
fn a_quiet_mode_offers_fewer_tools() {
    let dir = root();
    let kit = Kit::new(dir.path());
    kit.works_in(apex_agent_mode::Mode::Chat);
    let names: Vec<String> = kit.offered().into_iter().map(|one| one.name).collect();
    assert!(names.contains(&"read".to_owned()));
    assert!(!names.contains(&"write".to_owned()));
    assert!(!names.contains(&"bash".to_owned()));
}

#[test]
fn plan_mode_offers_the_list_and_no_hands() {
    let dir = root();
    let kit = Kit::new(dir.path());
    kit.works_in(apex_agent_mode::Mode::Plan);
    let names: Vec<String> = kit.offered().into_iter().map(|one| one.name).collect();
    assert!(names.contains(&"todo".to_owned()));
    assert!(!names.contains(&"edit".to_owned()));
}

#[tokio::test]
async fn a_tool_the_mode_shut_out_is_refused_even_if_the_model_asks_anyway() {
    let dir = root();
    let kit = Kit::new(dir.path());
    kit.works_in(apex_agent_mode::Mode::Chat);
    let done =
        ran(&kit, "write", serde_json::json!({ "path": "src/new.rs", "content": "x" })).await;
    assert!(!done.went_well());
    assert!(done.text().contains("not open in chat mode"));
    assert!(!dir.path().join("src/new.rs").exists());
}

#[tokio::test]
async fn a_tool_the_mode_allows_still_runs() {
    let dir = root();
    let kit = Kit::new(dir.path());
    kit.works_in(apex_agent_mode::Mode::Chat);
    let done = ran(&kit, "read", serde_json::json!({ "path": "src/one.rs" })).await;
    assert!(done.went_well(), "{}", done.text());
}

#[test]
fn a_kit_starts_out_yolo() {
    let dir = root();
    assert_eq!(Kit::new(dir.path()).mode(), apex_agent_mode::Mode::Auto);
}

#[test]
fn the_names_we_own_match_what_the_kit_offers() {
    let dir = root();
    let names: Vec<String> =
        Kit::new(dir.path()).offered().into_iter().map(|one| one.name).collect();
    let mut ours = our_names();
    ours.sort();
    let mut offered = names;
    offered.sort();
    assert_eq!(offered, ours);
}
