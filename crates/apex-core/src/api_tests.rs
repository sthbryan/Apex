use std::collections::BTreeMap;

use super::{
    Request, apply, ensure, environment_path, environments, fill, load, remove, request_path,
    requests, save, secrets, secrets_path, variables,
};
use crate::ApexPaths;

fn root() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    ensure(dir.path()).expect("folders");
    dir
}

fn posting() -> Request {
    Request {
        method: "POST".into(),
        url: "{{host}}/users".into(),
        headers: BTreeMap::from([("Content-Type".into(), "application/json".into())]),
        body: Some("{\"name\":\"ana\"}".into()),
    }
}

#[test]
fn a_saved_request_comes_back_whole() {
    let dir = root();
    save(dir.path(), "create user", &posting()).expect("save");
    assert_eq!(load(dir.path(), "create user").expect("load"), posting());
}

#[test]
fn a_request_only_needs_a_url() {
    let dir = root();
    let path = request_path(dir.path(), "ping").expect("path");
    std::fs::write(&path, "url = \"http://localhost:3000/health\"\n").expect("write");
    let found = load(dir.path(), "ping").expect("load");
    assert_eq!(found.method, "GET");
    assert!(found.headers.is_empty());
    assert_eq!(found.body, None);
}

#[test]
fn the_listing_is_sorted_and_skips_what_is_not_a_request() {
    let dir = root();
    save(dir.path(), "zeta", &posting()).expect("save");
    save(dir.path(), "alpha", &posting()).expect("save");
    std::fs::write(dir.path().join("requests").join("notes.md"), "no").expect("write");
    assert_eq!(requests(dir.path()), vec!["alpha".to_owned(), "zeta".to_owned()]);
    assert!(environments(dir.path()).is_empty());
}

#[test]
fn a_name_never_walks_out_of_the_folder() {
    let dir = root();
    for bad in ["../secret", "nested/name", ".hidden", "  ", "with\0null"] {
        assert!(request_path(dir.path(), bad).is_err(), "{bad}");
        assert!(save(dir.path(), bad, &posting()).is_err(), "{bad}");
    }
}

#[test]
fn a_name_keeps_its_spaces_and_case() {
    let dir = root();
    save(dir.path(), "  Create User  ", &posting()).expect("save");
    assert_eq!(requests(dir.path()), vec!["Create User".to_owned()]);
    assert_eq!(load(dir.path(), "Create User").expect("load"), posting());
}

#[test]
fn asking_for_a_request_nobody_saved_says_so() {
    let dir = root();
    let complaint = load(dir.path(), "missing").expect_err("no request").to_string();
    assert!(complaint.contains("missing"), "{complaint}");
    assert!(remove(dir.path(), "missing").is_err());
}

#[test]
fn broken_toml_names_the_request() {
    let dir = root();
    let path = request_path(dir.path(), "wrong").expect("path");
    std::fs::write(&path, "url = ").expect("write");
    let complaint = load(dir.path(), "wrong").expect_err("bad toml").to_string();
    assert!(complaint.contains("wrong"), "{complaint}");
}

#[test]
fn removing_takes_it_off_the_listing() {
    let dir = root();
    save(dir.path(), "gone", &posting()).expect("save");
    remove(dir.path(), "gone").expect("remove");
    assert!(requests(dir.path()).is_empty());
}

#[test]
fn the_collection_hangs_off_the_project_and_not_the_repo() {
    let paths = ApexPaths::rooted_at(std::path::Path::new("/home/someone"));
    let project = uuid::Uuid::nil();
    assert_eq!(
        paths.api_dir(project),
        std::path::Path::new("/home/someone/.apex/api/00000000-0000-0000-0000-000000000000")
    );
}

fn with_env(dir: &tempfile::TempDir, body: &str, secrets: &str) {
    std::fs::write(environment_path(dir.path(), "local").expect("path"), body).expect("env");
    if !secrets.is_empty() {
        std::fs::write(secrets_path(dir.path()), secrets).expect("secrets");
    }
}

#[test]
fn an_environment_reads_its_plain_values() {
    let dir = root();
    with_env(&dir, "host = \"http://localhost:3000\"\n", "");
    let found = variables(dir.path(), Some("local")).expect("variables");
    assert_eq!(found.get("host").map(String::as_str), Some("http://localhost:3000"));
}

#[test]
fn a_dollar_value_comes_from_the_env_file() {
    let dir = root();
    with_env(&dir, "token = \"$API_TOKEN\"\n", "API_TOKEN=abc123\n");
    let found = variables(dir.path(), Some("local")).expect("variables");
    assert_eq!(found.get("token").map(String::as_str), Some("abc123"));
}

#[test]
fn a_secret_that_is_not_there_names_itself_and_the_environment() {
    let dir = root();
    with_env(&dir, "token = \"$API_TOKEN\"\n", "OTHER=1\n");
    let complaint = format!("{:#}", variables(dir.path(), Some("local")).expect_err("no secret"));
    assert!(complaint.contains("API_TOKEN"), "{complaint}");
    assert!(complaint.contains("local"), "{complaint}");
}

#[test]
fn two_dollars_mean_a_literal_one() {
    let dir = root();
    with_env(&dir, "price = \"$$4.00\"\n", "");
    let found = variables(dir.path(), Some("local")).expect("variables");
    assert_eq!(found.get("price").map(String::as_str), Some("$4.00"));
}

#[test]
fn the_env_file_skips_blanks_and_comments_and_drops_quotes() {
    let dir = root();
    std::fs::write(
        secrets_path(dir.path()),
        "# a note\n\nA=one\nexport B=\"two\"\nC='three'\n=nokey\nD=with=signs\n",
    )
    .expect("secrets");
    let held = secrets(dir.path());
    assert_eq!(held.get("A").map(String::as_str), Some("one"));
    assert_eq!(held.get("B").map(String::as_str), Some("two"));
    assert_eq!(held.get("C").map(String::as_str), Some("three"));
    assert_eq!(held.get("D").map(String::as_str), Some("with=signs"));
    assert_eq!(held.len(), 4);
}

#[test]
fn no_environment_means_no_variables() {
    let dir = root();
    assert!(variables(dir.path(), None).expect("variables").is_empty());
    assert!(variables(dir.path(), Some("missing")).is_err());
}

#[test]
fn filling_swaps_every_mention() {
    let vars = BTreeMap::from([("host".to_owned(), "http://x".to_owned())]);
    assert_eq!(fill("{{host}}/a/{{host}}", &vars).expect("fill"), "http://x/a/http://x");
    assert_eq!(fill("{{ host }}", &vars).expect("fill"), "http://x");
    assert_eq!(fill("nothing here", &vars).expect("fill"), "nothing here");
}

#[test]
fn an_unset_variable_stops_the_request_instead_of_emptying_it() {
    let vars = BTreeMap::new();
    let complaint = fill("{{host}}/users", &vars).expect_err("no host").to_string();
    assert!(complaint.contains("host"), "{complaint}");
    assert!(fill("{{host", &vars).is_err());
}

#[test]
fn applying_fills_the_url_the_headers_and_the_body() {
    let vars = BTreeMap::from([
        ("host".to_owned(), "http://localhost:3000".to_owned()),
        ("token".to_owned(), "abc123".to_owned()),
        ("who".to_owned(), "ana".to_owned()),
    ]);
    let saved = Request {
        method: "post".into(),
        url: "{{host}}/users".into(),
        headers: BTreeMap::from([("Authorization".into(), "Bearer {{token}}".into())]),
        body: Some("{\"name\":\"{{who}}\"}".into()),
    };
    let ready = apply(&saved, &vars).expect("apply");
    assert_eq!(ready.method, "POST");
    assert_eq!(ready.url, "http://localhost:3000/users");
    assert_eq!(ready.headers.get("Authorization").map(String::as_str), Some("Bearer abc123"));
    assert_eq!(ready.body.as_deref(), Some("{\"name\":\"ana\"}"));
}

#[test]
fn applying_says_which_part_of_the_request_is_missing_a_value() {
    let saved = Request {
        method: "GET".into(),
        url: "http://x".into(),
        headers: BTreeMap::from([("Authorization".into(), "Bearer {{token}}".into())]),
        body: None,
    };
    let complaint = format!("{:#}", apply(&saved, &BTreeMap::new()).expect_err("no token"));
    assert!(complaint.contains("Authorization"), "{complaint}");
    assert!(complaint.contains("token"), "{complaint}");
}
