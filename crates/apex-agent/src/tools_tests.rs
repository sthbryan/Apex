use super::*;

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
    assert_eq!(names, vec!["read", "search", "find"]);
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
