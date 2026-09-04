use super::*;

fn provider(name: &str, env: Option<&str>) -> Provider {
    let mut provider =
        Provider::parse("name = \"stand-in\"\nlabel = \"Stand in\"\nkind = \"openai\"\n")
            .expect("parse");
    provider.name = name.to_owned();
    provider.env = env.map(str::to_owned);
    provider
}

#[test]
fn a_kept_key_comes_back_marked_as_stored() {
    let room = tempfile::tempdir().expect("room");
    let path = room.path().join("keys.json");
    keep_at(&path, "kept", "sk-live").expect("keep");
    let found = find_at(&path, &provider("kept", None)).expect("find").expect("a key");
    assert_eq!(found.key, "sk-live");
    assert_eq!(found.from, Source::Stored);
}

#[test]
fn a_provider_with_no_key_anywhere_finds_nothing() {
    let room = tempfile::tempdir().expect("room");
    assert_eq!(
        find_at(&room.path().join("keys.json"), &provider("bare", None)).expect("find"),
        None
    );
}

#[test]
fn a_stored_key_wins_over_the_environment() {
    let room = tempfile::tempdir().expect("room");
    let path = room.path().join("keys.json");
    keep_at(&path, "shadowed", "sk-kept").expect("keep");
    let found = find_at(&path, &provider("shadowed", Some("PATH"))).expect("find").expect("a key");
    assert_eq!(found.from, Source::Stored);
    assert_eq!(found.key, "sk-kept");
}

#[test]
fn the_environment_answers_when_nothing_was_stored() {
    let room = tempfile::tempdir().expect("room");
    let found = find_at(&room.path().join("keys.json"), &provider("borrowed", Some("PATH")))
        .expect("find")
        .expect("a key");
    assert_eq!(found.from, Source::Environment);
}

#[test]
fn forgetting_a_key_leaves_the_provider_bare() {
    let room = tempfile::tempdir().expect("room");
    let path = room.path().join("keys.json");
    keep_at(&path, "dropped", "sk-live").expect("keep");
    forget_at(&path, "dropped").expect("forget");
    assert_eq!(find_at(&path, &provider("dropped", None)).expect("find"), None);
}

#[test]
fn two_providers_do_not_share_a_key() {
    let room = tempfile::tempdir().expect("room");
    let path = room.path().join("keys.json");
    keep_at(&path, "one", "sk-one").expect("keep");
    keep_at(&path, "two", "sk-two").expect("keep");
    assert_eq!(find_at(&path, &provider("one", None)).expect("find").expect("a key").key, "sk-one");
    assert_eq!(find_at(&path, &provider("two", None)).expect("find").expect("a key").key, "sk-two");
}

#[cfg(unix)]
#[test]
fn the_store_is_private_to_the_user() {
    use std::os::unix::fs::PermissionsExt;

    let room = tempfile::tempdir().expect("room");
    let path = room.path().join("keys.json");
    keep_at(&path, "kept", "sk-live").expect("keep");
    assert_eq!(std::fs::metadata(path).expect("metadata").permissions().mode() & 0o777, 0o600);
}
