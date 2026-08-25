use std::collections::BTreeMap;

use super::{Request, ensure, environments, load, remove, request_path, requests, save};
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
